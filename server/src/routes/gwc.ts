import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsGwcJson, asArray, mapLimit, type GeoServerConfig } from '../geoserver';

const r = Router();

function cfgFor(host: string, port: number, username: string, password: string): GeoServerConfig {
  return { host, port, username, password };
}

r.get('/:id/gwc', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [names, diskQuotaRaw] = await Promise.all([
      gsGwcJson<string[]>(cfg, '/layers.json').catch(() => [] as string[]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gsGwcJson<any>(cfg, '/diskquota.json').catch(() => null),
    ]);

    const tileLayers = await mapLimit(names, 8, async (name) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsGwcJson<any>(cfg, `/layers/${encodeURIComponent(name)}.json`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const l: any = d?.GeoServerLayer ?? d?.layer ?? d;
        return {
          name: l?.name ?? name,
          enabled: l?.enabled ?? false,
          inMemoryCached: l?.inMemoryCached ?? false,
          mimeFormats: asArray<string>(l?.mimeFormats),
          gridSubsets: asArray<{ gridSetName?: string }>(l?.gridSubsets)
            .map((g) => g.gridSetName ?? '')
            .filter(Boolean),
        };
      } catch (err) {
        return {
          name,
          enabled: false,
          inMemoryCached: false,
          mimeFormats: [] as string[],
          gridSubsets: [] as string[],
          error: err instanceof Error ? err.message : 'Ошибка',
        };
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dq: any = diskQuotaRaw?.['org.geowebcache.diskquota.DiskQuotaConfig'] ?? Object.values(diskQuotaRaw ?? {})[0];
    res.json({
      diskQuota: dq
        ? {
            enabled: dq.enabled ?? false,
            cacheCleanUpFrequency: dq.cacheCleanUpFrequency ?? 0,
            cacheCleanUpUnits: dq.cacheCleanUpUnits ?? '',
            maxConcurrentCleanUps: dq.maxConcurrentCleanUps ?? 0,
            globalExpirationPolicyName: dq.globalExpirationPolicyName ?? '',
            globalQuotaBytes: dq.globalQuota?.bytes ?? 0,
          }
        : null,
      tileLayers,
    });
  } catch (e) {
    next(e);
  }
});

export default r;
