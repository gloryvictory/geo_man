import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsJson, gsText, asArray, mapLimit, type GeoServerConfig } from '../geoserver';

const r = Router();

function cfgFor(host: string, port: number, username: string, password: string): GeoServerConfig {
  return { host, port, username, password };
}

interface StyleEntry {
  name: string;
  href: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseStyle(name: string, href: string, s: any) {
  return {
    name,
    workspace: s?.workspace ?? null,
    format: s?.format ?? '',
    version: s?.languageVersion?.version ?? '',
    filename: s?.filename ?? '',
    href,
  };
}

r.get('/:id/styles', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const list = await gsJson<{ styles?: { style?: StyleEntry[] | StyleEntry } }>(cfg, '/styles.json');
    const entries = asArray(list?.styles?.style);

    const styles = await mapLimit(entries, 8, async (e) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsJson<any>(cfg, `/styles/${encodeURIComponent(e.name)}.json`);
        return parseStyle(e.name, e.href, d?.style);
      } catch (err) {
        return { name: e.name, workspace: null, format: '', version: '', filename: '', href: e.href, error: err instanceof Error ? err.message : 'Ошибка' };
      }
    });

    res.json(styles);
  } catch (e) {
    next(e);
  }
});

r.get('/:id/styles/:name', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const name = req.params.name;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [d, sld] = await Promise.all([
      gsJson<any>(cfg, `/styles/${encodeURIComponent(name)}.json`),
      gsText(cfg, `/styles/${encodeURIComponent(name)}.sld`),
    ]);

    const parsed = parseStyle(name, '', d?.style) as Record<string, unknown>;
    parsed.sld = sld;
    res.json(parsed);
  } catch (e) {
    next(e);
  }
});

export default r;
