import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsText, gsJson, gsFetch, type GeoServerConfig } from '../geoserver';

const r = Router();

interface ConnLike {
  host: string;
  port: number;
  username: string;
  scheme?: string;
}

function cfgFor(c: ConnLike, password: string): GeoServerConfig {
  return { host: c.host, port: c.port, username: c.username, password, scheme: c.scheme ?? 'http' };
}

/** Разбор квалифицированного имени «workspace:name». */
function splitName(raw: string): { workspace: string | null; name: string } {
  const i = raw.indexOf(':');
  return i >= 0 ? { workspace: raw.slice(0, i), name: raw.slice(i + 1) } : { workspace: null, name: raw };
}

async function copyStyle(src: GeoServerConfig, dst: GeoServerConfig, srcRaw: string, dstRaw?: string): Promise<void> {
  const s = splitName(srcRaw);
  const d = splitName(dstRaw ?? srcRaw);
  const sldPath = s.workspace
    ? `/workspaces/${encodeURIComponent(s.workspace)}/styles/${encodeURIComponent(s.name)}.sld`
    : `/styles/${encodeURIComponent(s.name)}.sld`;
  const sld = await gsText(src, sldPath);
  if (dstRaw) {
    // создать новый стиль с новым именем (PUT обновляет только существующий)
    const createPath = d.workspace
      ? `/workspaces/${encodeURIComponent(d.workspace)}/styles?name=${encodeURIComponent(d.name)}`
      : `/styles?name=${encodeURIComponent(d.name)}`;
    await gsFetch(dst, createPath, {
      method: 'POST',
      body: sld,
      headers: { 'Content-Type': 'application/vnd.ogc.sld+xml' },
    });
  } else {
    const dstPath = d.workspace
      ? `/workspaces/${encodeURIComponent(d.workspace)}/styles/${encodeURIComponent(d.name)}`
      : `/styles/${encodeURIComponent(d.name)}`;
    await gsFetch(dst, dstPath, {
      method: 'PUT',
      body: sld,
      headers: { 'Content-Type': 'application/vnd.ogc.sld+xml' },
    });
  }
}

async function copyWorkspace(dst: GeoServerConfig, name: string): Promise<void> {
  await gsFetch(dst, '/workspaces', {
    method: 'POST',
    body: JSON.stringify({ workspace: { name } }),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function copyLayergroup(src: GeoServerConfig, dst: GeoServerConfig, srcRaw: string, dstRaw?: string): Promise<void> {
  const s = splitName(srcRaw);
  const d = splitName(dstRaw ?? srcRaw);
  const gPath = s.workspace
    ? `/workspaces/${encodeURIComponent(s.workspace)}/layergroups/${encodeURIComponent(s.name)}.json`
    : `/layergroups/${encodeURIComponent(s.name)}.json`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await gsJson<any>(src, gPath);
  const body = { ...(data?.layerGroup ?? data) };
  body.name = d.name;
  delete body.workspace;
  delete body.dateCreated;
  delete body.dateModified;
  delete body.bounds;
  const dstPath = d.workspace
    ? `/workspaces/${encodeURIComponent(d.workspace)}/layergroups`
    : `/layergroups`;
  await gsFetch(dst, dstPath, {
    method: 'POST',
    body: JSON.stringify({ layerGroup: body }),
    headers: { 'Content-Type': 'application/json' },
  });
}

r.post('/:sourceId/clone', async (req, res, next) => {
  try {
    const src = getConnection(req.params.sourceId);
    if (!src) return res.status(404).json({ error: 'Исходное подключение не найдено' });
    const { targetId, type, names } = (req.body ?? {}) as { targetId?: string; type?: string; names?: string[] };
    if (!targetId || !Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'Укажите целевое подключение и элементы для копирования' });
    }
    const dst = getConnection(targetId);
    if (!dst) return res.status(400).json({ error: 'Целевое подключение не найдено' });

    const srcCfg = cfgFor({ ...src }, getSavedPassword(src.id) ?? '');
    const dstCfg = cfgFor({ ...dst }, getSavedPassword(dst.id) ?? '');

    const results: { name: string; ok: boolean; error?: string }[] = [];
    for (const name of names) {
      try {
        if (type === 'style') await copyStyle(srcCfg, dstCfg, name);
        else if (type === 'workspace') await copyWorkspace(dstCfg, name);
        else if (type === 'layergroup') await copyLayergroup(srcCfg, dstCfg, name);
        else throw new Error('Копирование этого типа ресурса не поддерживается');
        results.push({ name, ok: true });
      } catch (e) {
        results.push({ name, ok: false, error: e instanceof Error ? e.message : 'Ошибка' });
      }
    }

    res.json({ results });
  } catch (e) {
    next(e);
  }
});

r.post('/:sourceId/clone-as', async (req, res, next) => {
  try {
    const src = getConnection(req.params.sourceId);
    if (!src) return res.status(404).json({ error: 'Исходное подключение не найдено' });
    const { targetId, type, name, newName } = (req.body ?? {}) as { targetId?: string; type?: string; name?: string; newName?: string };
    if (!targetId || !name || !newName || !String(newName).trim()) {
      return res.status(400).json({ error: 'Укажите целевое подключение и новое имя' });
    }
    const dst = getConnection(targetId);
    if (!dst) return res.status(400).json({ error: 'Целевое подключение не найдено' });

    const srcCfg = cfgFor({ ...src }, getSavedPassword(src.id) ?? '');
    const dstCfg = cfgFor({ ...dst }, getSavedPassword(dst.id) ?? '');
    const newNameTrim = String(newName).trim();

    if (type === 'style') await copyStyle(srcCfg, dstCfg, name, newNameTrim);
    else if (type === 'workspace') await copyWorkspace(dstCfg, newNameTrim);
    else if (type === 'layergroup') await copyLayergroup(srcCfg, dstCfg, name, newNameTrim);
    else return res.status(400).json({ error: 'Копирование этого типа ресурса не поддерживается' });

    res.json({ ok: true, name: newNameTrim });
  } catch (e) {
    next(e);
  }
});

export default r;
