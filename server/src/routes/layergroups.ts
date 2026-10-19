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

interface GroupRef {
  name: string;
  href: string;
  workspace: string | null;
}

function groupDetailPath(ref: GroupRef): string {
  const nm = encodeURIComponent(ref.name);
  if (ref.workspace) return `/workspaces/${encodeURIComponent(ref.workspace)}/layergroups/${nm}.json`;
  return `/layergroups/${nm}.json`;
}

/** Все группы слоёв: глобальные + по каждой рабочей области. */
async function allGroupRefs(cfg: GeoServerConfig): Promise<GroupRef[]> {
  const [glob, ws] = await Promise.all([
    gsJson<{ layerGroups?: { layerGroup?: GroupEntry[] | GroupEntry } }>(cfg, '/layergroups.json'),
    gsJson<{ workspaces?: { workspace?: { name: string }[] | { name: string } } }>(cfg, '/workspaces.json'),
  ]);
  const global = asArray(glob?.layerGroups?.layerGroup).map((e) => ({ name: e.name, href: e.href, workspace: null }));
  const wsNames = asArray(ws?.workspaces?.workspace).map((w) => w.name);
  const perWs = await mapLimit(wsNames, 8, async (wsName) => {
    try {
      const g = await gsJson<{ layerGroups?: { layerGroup?: GroupEntry[] | GroupEntry } }>(
        cfg,
        `/workspaces/${encodeURIComponent(wsName)}/layergroups.json`
      );
      return asArray(g?.layerGroups?.layerGroup).map((e) => ({ name: e.name, href: e.href, workspace: wsName }));
    } catch {
      return [] as GroupRef[];
    }
  });
  return [...global, ...perWs.flat()];
}

r.get('/:id/layergroups', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const refs = await allGroupRefs(cfg);
    const groups = await mapLimit(refs, 8, async (ref) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsJson<any>(cfg, groupDetailPath(ref));
        const g = d?.layerGroup;
        const layers = asArray<{ name: string }>(g?.publishables?.published).map((p) => p.name);
        const styles = asArray<{ name: string }>(g?.styles?.style).map((s) => s.name);
        return {
          name: ref.name,
          workspace: ref.workspace ?? g?.workspace?.name ?? null,
          mode: g?.mode ?? null,
          title: g?.title ?? null,
          layers,
          styles,
          layerCount: layers.length,
          href: ref.href,
        };
      } catch (err) {
        return {
          name: ref.name,
          workspace: ref.workspace,
          mode: null,
          title: null,
          layers: [],
          styles: [],
          layerCount: 0,
          href: ref.href,
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
