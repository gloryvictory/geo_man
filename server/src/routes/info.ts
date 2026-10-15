import { Router } from 'express';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsJson, asArray, type GeoServerConfig } from '../geoserver';

const r = Router();

function cfgFor(host: string, port: number, username: string, password: string): GeoServerConfig {
  return { host, port, username, password };
}

interface AboutResource {
  '@name'?: string;
  Version?: string | number;
  'Build-Timestamp'?: string;
  'Git-Revision'?: string;
}

r.get('/:id/info', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const [version, ws, layers, styles] = await Promise.all([
      gsJson<{ about?: { resource?: AboutResource[] | AboutResource } }>(cfg, '/about/version.json'),
      gsJson<{ workspaces?: { workspace?: { name: string }[] | { name: string } } }>(cfg, '/workspaces.json'),
      gsJson<{ layers?: { layer?: { name: string }[] | { name: string } } }>(cfg, '/layers.json'),
      gsJson<{ styles?: { style?: { name: string }[] | { name: string } } }>(cfg, '/styles.json'),
    ]);

    const resources = asArray(version?.about?.resource);
    const gs = resources.find((r) => r['@name'] === 'GeoServer');
    const modules = resources
      .filter((r) => r['@name'] !== 'GeoServer')
      .map((r) => ({ name: r['@name'] ?? '?', version: r.Version != null ? String(r.Version) : '' }));

    const workspaces = asArray(ws?.workspaces?.workspace).map((w) => w.name);
    const layerNames = asArray(layers?.layers?.layer).map((l) => l.name);
    const styleNames = asArray(styles?.styles?.style).map((s) => s.name);

    res.json({
      version: gs ? String(gs.Version ?? '') : '',
      buildTimestamp: gs?.['Build-Timestamp'] ?? '',
      gitRevision: gs?.['Git-Revision'] ?? '',
      modules,
      workspaceCount: workspaces.length,
      layerCount: layerNames.length,
      styleCount: styleNames.length,
      workspaces,
    });
  } catch (e) {
    next(e);
  }
});

export default r;
