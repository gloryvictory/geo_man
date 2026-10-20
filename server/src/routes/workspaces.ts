import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsJson, asArray, mapLimit, type GeoServerConfig } from '../geoserver';

const r = Router();

function cfgFor(host: string, port: number, username: string, password: string, scheme = 'http'): GeoServerConfig {
  return { host, port, username, password, scheme };
}

interface WsEntry {
  name: string;
  href: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseWorkspace(name: string, href: string, w: any) {
  return {
    name,
    isolated: w?.isolated ?? false,
    dateCreated: w?.dateCreated ?? null,
    dateModified: w?.dateModified ?? null,
    href,
  };
}

const STORE_KINDS = [
  { path: 'datastores', listKey: 'dataStores', itemKey: 'dataStore' },
  { path: 'coveragestores', listKey: 'coverageStores', itemKey: 'coverageStore' },
  { path: 'wmsstores', listKey: 'wmsStores', itemKey: 'wmsStore' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countStores(cfg: GeoServerConfig, wsName: string): Promise<number> {
  let total = 0;
  await Promise.all(
    STORE_KINDS.map(async (k) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsJson<any>(cfg, `/workspaces/${encodeURIComponent(wsName)}/${k.path}.json`);
        total += asArray<{ name: string }>(d?.[k.listKey]?.[k.itemKey]).length;
      } catch {
        /* пропускаем тип хранилища */
      }
    })
  );
  return total;
}

r.get('/:id/workspaces', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '', conn.scheme);

    const [list, def] = await Promise.all([
      gsJson<{ workspaces?: { workspace?: WsEntry[] | WsEntry } }>(cfg, '/workspaces.json'),
      gsJson<{ workspace?: { name?: string } }>(cfg, '/workspaces/default.json').catch(() => null),
    ]);
    const defaultName = def?.workspace?.name ?? '';
    const entries = asArray(list?.workspaces?.workspace);

    const workspaces = await mapLimit(entries, 8, async (e) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsJson<any>(cfg, `/workspaces/${encodeURIComponent(e.name)}.json`);
        const storeCount = await countStores(cfg, e.name);
        return { ...parseWorkspace(e.name, e.href, d?.workspace), isDefault: e.name === defaultName, storeCount };
      } catch (err) {
        return { name: e.name, isolated: false, dateCreated: null, dateModified: null, href: e.href, isDefault: e.name === defaultName, storeCount: 0, error: err instanceof Error ? err.message : 'Ошибка' };
      }
    });

    res.json(workspaces);
  } catch (e) {
    next(e);
  }
});

r.get('/:id/workspaces/:name', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '', conn.scheme);

    const name = req.params.name;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [d, ds] = await Promise.all([
      gsJson<any>(cfg, `/workspaces/${encodeURIComponent(name)}.json`),
      gsJson<any>(cfg, `/workspaces/${encodeURIComponent(name)}/datastores.json`),
    ]);

    const parsed = parseWorkspace(name, '', d?.workspace) as Record<string, unknown>;
    parsed.dataStores = asArray<{ name: string }>(ds?.dataStores?.dataStore).map((s) => s.name);
    res.json(parsed);
  } catch (e) {
    next(e);
  }
});

export default r;
