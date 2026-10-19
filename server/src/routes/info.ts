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

interface ManifestResource {
  '@name'?: string;
  'Implementation-Title'?: string;
  'Bundle-Name'?: string;
  'Implementation-Version'?: string | number;
  'Specification-Version'?: string | number;
  'Bundle-Version'?: string | number;
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

r.get('/:id/manifest', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');

    const manifest = await gsJson<{ about?: { resource?: ManifestResource[] | ManifestResource } }>(cfg, '/about/manifest.json');
    const resources = asArray(manifest?.about?.resource);
    const entries = resources
      .map((r) => ({
        name: r['@name'] ?? '?',
        title: r['Implementation-Title'] ?? r['Bundle-Name'] ?? '',
        version: str(r['Implementation-Version']) || str(r['Specification-Version']) || str(r['Bundle-Version']),
      }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    res.json(entries);
  } catch (e) {
    next(e);
  }
});

export default r;
