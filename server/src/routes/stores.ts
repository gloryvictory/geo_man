import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsJson, asArray, mapLimit, type GeoServerConfig } from '../geoserver';

const r = Router();

function cfgFor(host: string, port: number, username: string, password: string, scheme = 'http'): GeoServerConfig {
  return { host, port, username, password, scheme };
}

const KIND = {
  data: { path: 'datastores', listKey: 'dataStores', itemKey: 'dataStore' },
  coverage: { path: 'coveragestores', listKey: 'coverageStores', itemKey: 'coverageStore' },
  wms: { path: 'wmsstores', listKey: 'wmsStores', itemKey: 'wmsStore' },
} as const;
type StoreKind = keyof typeof KIND;

interface StoreRef {
  workspace: string;
  kind: StoreKind;
  name: string;
  href: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseStore(ref: StoreRef, s: any) {
  return {
    name: s?.name ?? ref.name,
    workspace: s?.workspace?.name ?? ref.workspace,
    storeType: ref.kind,
    type: s?.type ?? null,
    enabled: s?.enabled ?? true,
    description: s?.description ?? null,
    dateCreated: s?.dateCreated ?? null,
    dateModified: s?.dateModified ?? null,
    href: ref.href,
  };
}

r.get('/:id/stores', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '', conn.scheme);

    const wsList = await gsJson<{ workspaces?: { workspace?: { name: string }[] | { name: string } } }>(cfg, '/workspaces.json');
    const workspaces = asArray(wsList?.workspaces?.workspace).map((w) => w.name);

    const pairs: { ws: string; kind: StoreKind }[] = [];
    for (const ws of workspaces) {
      for (const kind of Object.keys(KIND) as StoreKind[]) pairs.push({ ws, kind });
    }

    const lists = await mapLimit(pairs, 8, async ({ ws, kind }) => {
      const k = KIND[kind];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = await gsJson<any>(cfg, `/workspaces/${encodeURIComponent(ws)}/${k.path}.json`);
        const items = asArray<{ name: string; href: string }>(list?.[k.listKey]?.[k.itemKey]);
        return items.map((it) => ({ workspace: ws, kind, name: it.name, href: it.href }));
      } catch {
        return [] as StoreRef[];
      }
    });
    const refs = lists.flat();

    const stores = await mapLimit(refs, 8, async (ref) => {
      const k = KIND[ref.kind];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsJson<any>(cfg, `/workspaces/${encodeURIComponent(ref.workspace)}/${k.path}/${encodeURIComponent(ref.name)}.json`);
        return parseStore(ref, d?.[k.itemKey]);
      } catch (err) {
        return { ...parseStore(ref, {}), error: err instanceof Error ? err.message : 'Ошибка' };
      }
    });

    res.json(stores);
  } catch (e) {
    next(e);
  }
});

export default r;
