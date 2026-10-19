import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsJson, gsGwcJson, asArray, mapLimit, type GeoServerConfig } from '../geoserver';

const r = Router();

function cfgFor(host: string, port: number, username: string, password: string): GeoServerConfig {
  return { host, port, username, password };
}

function splitName(full: string): { workspace: string; layer: string } {
  const i = full.indexOf(':');
  if (i < 0) return { workspace: '', layer: full };
  return { workspace: full.slice(0, i), layer: full.slice(i + 1) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLayer(fullName: string, href: string, l: any) {
  const { workspace, layer } = splitName(fullName);
  return {
    name: fullName,
    workspace,
    layer: l?.name ?? layer,
    type: l?.type ?? null,
    defaultStyle: l?.defaultStyle?.name ?? null,
    resourceClass: l?.resource?.['@class'] ?? null,
    resourceName: l?.resource?.name ?? null,
    availableStyles: asArray<{ name: string }>(l?.styles?.style).map((s) => s.name),
    href,
  };
}

function errorEntry(fullName: string, href: string, message: string) {
  const { workspace, layer } = splitName(fullName);
  return {
    name: fullName,
    workspace,
    layer,
    type: null,
    defaultStyle: null,
    resourceClass: null,
    resourceName: null,
    availableStyles: [] as string[],
    href,
    error: message,
  };
}

interface StoreKind {
  path: string;
  listKey: string;
  itemKey: string;
  resPath: string;
  resListKey: string;
  resItemKey: string;
}

const STORE_KINDS: StoreKind[] = [
  { path: 'datastores', listKey: 'dataStores', itemKey: 'dataStore', resPath: 'featuretypes', resListKey: 'featureTypes', resItemKey: 'featureType' },
  { path: 'coveragestores', listKey: 'coverageStores', itemKey: 'coverageStore', resPath: 'coverages', resListKey: 'coverages', resItemKey: 'coverage' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function connParamMap(cp: any): Record<string, string> {
  const out: Record<string, string> = {};
  const entries = asArray<{ '@key'?: string; $?: string }>(cp?.entry);
  for (const e of entries) {
    if (e?.['@key'] != null) out[e['@key']] = e.$ ?? '';
  }
  return out;
}

// GeoServer может вернуть CRS как строку "EPSG:4326" или как объект {"@class":..., "$":"EPSG:3857"}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function crsStr(v: any): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && v.$ != null) return String(v.$);
  return '';
}

interface AnalyticsRow {
  l_name: string;
  l_title: string;
  l_projection: string;
  w_name: string;
  w_name_full: string;
  s_name: string;
  s_host: string;
  s_port: string;
  s_database: string;
  s_schema: string;
  s_native_name: string;
  s_user: string;
  s_dbtype: string;
  s_native_srs: string;
}

interface LayerEntry {
  name: string;
  href: string;
}

r.get('/:id/layers', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const [list, gwcList] = await Promise.all([
      gsJson<{ layers?: { layer?: LayerEntry[] | LayerEntry } }>(cfg, '/layers.json'),
      gsGwcJson<string[]>(cfg, '/layers.json').catch(() => [] as string[]),
    ]);
    const gwcSet = new Set(gwcList);
    const entries = asArray(list?.layers?.layer);

    const layers = await mapLimit(entries, 8, async (e) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsJson<any>(cfg, `/layers/${encodeURIComponent(e.name)}.json`);
        return { ...parseLayer(e.name, e.href, d?.layer), gwc: gwcSet.has(e.name) };
      } catch (err) {
        return { ...errorEntry(e.name, e.href, err instanceof Error ? err.message : 'Ошибка'), gwc: gwcSet.has(e.name) };
      }
    });

    res.json(layers);
  } catch (e) {
    next(e);
  }
});

r.get('/:id/layers/analytics', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const wsList = await gsJson<{ workspaces?: { workspace?: { name: string }[] | { name: string } } }>(cfg, '/workspaces.json');
    const workspaces = asArray(wsList?.workspaces?.workspace).map((w) => w.name);

    const storeTasks: { ws: string; kind: StoreKind; name: string }[] = [];
    for (const ws of workspaces) {
      for (const k of STORE_KINDS) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const list = await gsJson<any>(cfg, `/workspaces/${encodeURIComponent(ws)}/${k.path}.json`);
          const stores = asArray<{ name: string }>(list?.[k.listKey]?.[k.itemKey]);
          for (const s of stores) storeTasks.push({ ws, kind: k, name: s.name });
        } catch {
          /* пропускаем тип хранилища */
        }
      }
    }

    const resTasks = (
      await mapLimit(storeTasks, 8, async ({ ws, kind, name }) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const storeDetail = await gsJson<any>(cfg, `/workspaces/${encodeURIComponent(ws)}/${kind.path}/${encodeURIComponent(name)}.json`);
          const connMap = connParamMap(storeDetail?.[kind.itemKey]?.connectionParameters);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const resList = await gsJson<any>(cfg, `/workspaces/${encodeURIComponent(ws)}/${kind.path}/${encodeURIComponent(name)}/${kind.resPath}.json`);
          const resources = asArray<{ name: string }>(resList?.[kind.resListKey]?.[kind.resItemKey]);
          return resources.map((r) => ({ ws, kind, storeName: name, resName: r.name, connMap }));
        } catch {
          return [] as { ws: string; kind: StoreKind; storeName: string; resName: string; connMap: Record<string, string> }[];
        }
      })
    ).flat();

    const rows = (
      await mapLimit(resTasks, 8, async ({ ws, kind, storeName, resName, connMap }) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = await gsJson<any>(cfg, `/workspaces/${encodeURIComponent(ws)}/${kind.path}/${encodeURIComponent(storeName)}/${kind.resPath}/${encodeURIComponent(resName)}.json`);
          const info = d?.[kind.resItemKey];
          const row: AnalyticsRow = {
            l_name: info?.name ?? resName,
            l_title: info?.title ?? '',
            l_projection: info?.srs ?? '',
            w_name: ws,
            w_name_full: `${ws}:${info?.name ?? resName}`,
            s_name: storeName,
            s_host: connMap['host'] ?? '',
            s_port: connMap['port'] ?? '',
            s_database: connMap['database'] ?? '',
            s_schema: connMap['schema'] ?? '',
            s_native_name: info?.nativeName ?? '',
            s_user: connMap['user'] ?? '',
            s_dbtype: connMap['dbtype'] ?? '',
            s_native_srs: crsStr(info?.nativeBoundingBox?.crs) || crsStr(info?.nativeCRS) || '',
          };
          return row;
        } catch {
          return null;
        }
      })
    ).filter((r): r is AnalyticsRow => r != null);

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.get('/:id/layers/:name', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const name = req.params.name;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = await gsJson<any>(cfg, `/layers/${encodeURIComponent(name)}.json`);
    const parsed = parseLayer(name, '', d?.layer) as Record<string, unknown>;
    parsed.attribution = d?.layer?.attribution ?? null;
    res.json(parsed);
  } catch (e) {
    next(e);
  }
});

export default r;
