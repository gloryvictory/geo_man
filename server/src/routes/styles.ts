import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsJson, gsText, asArray, mapLimit, type GeoServerConfig } from '../geoserver';
import AdmZip from 'adm-zip';

const r = Router();

function cfgFor(host: string, port: number, username: string, password: string): GeoServerConfig {
  return { host, port, username, password };
}

interface StyleEntry {
  name: string;
  href: string;
}

interface StyleRef {
  name: string;
  href: string;
  workspace: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseStyle(ref: StyleRef, s: any) {
  return {
    name: ref.name,
    workspace: ref.workspace ?? s?.workspace ?? null,
    format: s?.format ?? '',
    version: s?.languageVersion?.version ?? '',
    filename: s?.filename ?? '',
    href: ref.href,
  };
}

function detailPath(ref: StyleRef, suffix: '.json' | '.sld'): string {
  const nm = encodeURIComponent(ref.name);
  if (ref.workspace) return `/workspaces/${encodeURIComponent(ref.workspace)}/styles/${nm}${suffix}`;
  return `/styles/${nm}${suffix}`;
}

/** Все стили: глобальные + по каждой рабочей области. */
async function allStyleRefs(cfg: GeoServerConfig): Promise<StyleRef[]> {
  const [glob, ws] = await Promise.all([
    gsJson<{ styles?: { style?: StyleEntry[] | StyleEntry } }>(cfg, '/styles.json'),
    gsJson<{ workspaces?: { workspace?: { name: string }[] | { name: string } } }>(cfg, '/workspaces.json'),
  ]);
  const global = asArray(glob?.styles?.style).map((e) => ({ name: e.name, href: e.href, workspace: null }));
  const wsNames = asArray(ws?.workspaces?.workspace).map((w) => w.name);
  const perWs = await mapLimit(wsNames, 8, async (wsName) => {
    try {
      const s = await gsJson<{ styles?: { style?: StyleEntry[] | StyleEntry } }>(
        cfg,
        `/workspaces/${encodeURIComponent(wsName)}/styles.json`
      );
      return asArray(s?.styles?.style).map((e) => ({ name: e.name, href: e.href, workspace: wsName }));
    } catch {
      return [] as StyleRef[];
    }
  });
  return [...global, ...perWs.flat()];
}

r.get('/:id/styles', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const refs = await allStyleRefs(cfg);
    const styles = await mapLimit(refs, 8, async (ref) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsJson<any>(cfg, detailPath(ref, '.json'));
        return parseStyle(ref, d?.style);
      } catch (err) {
        return { ...parseStyle(ref, {}), error: err instanceof Error ? err.message : 'Ошибка' };
      }
    });

    res.json(styles);
  } catch (e) {
    next(e);
  }
});

r.get('/:id/styles/export', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const refs = await allStyleRefs(cfg);
    const zip = new AdmZip();
    await mapLimit(refs, 8, async (ref) => {
      try {
        const sld = await gsText(cfg, detailPath(ref, '.sld'));
        const entry = ref.workspace ? `${ref.workspace}/${ref.name}.sld` : `${ref.name}.sld`;
        zip.addFile(entry, Buffer.from(sld, 'utf8'));
      } catch {
        /* пропускаем стиль, если не удалось получить его SLD */
      }
    });

    const buf = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="geo_man_styles.zip"');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

r.get('/:id/styles/:name', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    // имя может быть «workspace:name» для стиля рабочей области
    const raw = req.params.name;
    const i = raw.indexOf(':');
    const ref: StyleRef =
      i >= 0 ? { name: raw.slice(i + 1), href: '', workspace: raw.slice(0, i) } : { name: raw, href: '', workspace: null };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [d, sld] = await Promise.all([
      gsJson<any>(cfg, detailPath(ref, '.json')),
      gsText(cfg, detailPath(ref, '.sld')),
    ]);

    const parsed = parseStyle(ref, d?.style) as Record<string, unknown>;
    parsed.sld = sld;
    res.json(parsed);
  } catch (e) {
    next(e);
  }
});

export default r;
