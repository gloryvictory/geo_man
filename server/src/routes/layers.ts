import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsJson, asArray, mapLimit, type GeoServerConfig } from '../geoserver';

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

interface LayerEntry {
  name: string;
  href: string;
}

r.get('/:id/layers', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const list = await gsJson<{ layers?: { layer?: LayerEntry[] | LayerEntry } }>(cfg, '/layers.json');
    const entries = asArray(list?.layers?.layer);

    const layers = await mapLimit(entries, 8, async (e) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = await gsJson<any>(cfg, `/layers/${encodeURIComponent(e.name)}.json`);
        return parseLayer(e.name, e.href, d?.layer);
      } catch (err) {
        return errorEntry(e.name, e.href, err instanceof Error ? err.message : 'Ошибка');
      }
    });

    res.json(layers);
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
