import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsJson, asArray, mapLimit, type GeoServerConfig } from '../geoserver';

const r = Router();

function cfgFor(host: string, port: number, username: string, password: string): GeoServerConfig {
  return { host, port, username, password };
}

interface GroupEntry {
  name: string;
  href: string;
}

r.get('/:id/layergroups', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const list = await gsJson<{ layerGroups?: { layerGroup?: GroupEntry[] | GroupEntry } }>(cfg, '/layergroups.json');
    const entries = asArray(list?.layerGroups?.layerGroup);

    const groups = await mapLimit(entries, 8, async (e) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsJson<any>(cfg, `/layergroups/${encodeURIComponent(e.name)}.json`);
        const g = d?.layerGroup;
        const layers = asArray<{ name: string }>(g?.publishables?.published).map((p) => p.name);
        const styles = asArray<{ name: string }>(g?.styles?.style).map((s) => s.name);
        return {
          name: e.name,
          workspace: g?.workspace?.name ?? null,
          mode: g?.mode ?? null,
          title: g?.title ?? null,
          layers,
          styles,
          layerCount: layers.length,
          href: e.href,
        };
      } catch (err) {
        return {
          name: e.name,
          workspace: null,
          mode: null,
          title: null,
          layers: [],
          styles: [],
          layerCount: 0,
          href: e.href,
          error: err instanceof Error ? err.message : 'Ошибка',
        };
      }
    });

    res.json(groups);
  } catch (e) {
    next(e);
  }
});

export default r;
