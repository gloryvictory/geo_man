import { Router } from 'express';
import { TextDecoder } from 'node:util';
import { getConnection, getSavedPassword } from '../sqlite';
import { gsJson, gsText, gsBuffer, gsDataDirectory, asArray, type GeoServerConfig } from '../geoserver';

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

    let dataDirectory = '';
    try {
      dataDirectory = await gsDataDirectory(cfg);
    } catch {
      dataDirectory = '';
    }

    res.json({
      version: gs ? String(gs.Version ?? '') : '',
      buildTimestamp: gs?.['Build-Timestamp'] ?? '',
      gitRevision: gs?.['Git-Revision'] ?? '',
      modules,
      workspaceCount: workspaces.length,
      layerCount: layerNames.length,
      styleCount: styleNames.length,
      workspaces,
      dataDirectory,
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

interface ModuleStatus {
  name: string;
  module: string;
  component: string;
  version: string;
  enabled: boolean;
  available: boolean;
  message: string;
}

function decodeEntities(s: string): string {
  const once = (t: string) =>
    t
      .replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const first = once(s);
  // GeoServer экранирует сообщения дважды (напр. &amp;apos;)
  return /&amp;|&apos;|&quot;|&lt;|&gt;/.test(first) ? once(first) : first;
}

function parseModuleStatus(html: string): ModuleStatus[] {
  const out: ModuleStatus[] = [];
  const blockRe = /<h3>\s*Module name:\s*([^<]+)\s*<\/h3>([\s\S]*?)(?=<h3>|$)/g;
  const kvRe = /<li><b>([^<]+)<\/b>\s*:\s*([^<]*)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const item: ModuleStatus = {
      name: decodeEntities(m[1].trim()),
      module: '',
      component: '',
      version: '',
      enabled: false,
      available: false,
      message: '',
    };
    kvRe.lastIndex = 0;
    let kv: RegExpExecArray | null;
    while ((kv = kvRe.exec(m[2])) !== null) {
      const key = kv[1].trim();
      const val = decodeEntities(kv[2].trim());
      if (key === 'Module') item.module = val;
      else if (key === 'Component') item.component = val;
      else if (key === 'Version') item.version = val;
      else if (key === 'Enabled') item.enabled = val === 'true';
      else if (key === 'Available') item.available = val === 'true';
      else if (key === 'Message') item.message = val;
    }
    out.push(item);
  }
  return out;
}

r.get('/:id/modules', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');
    const html = await gsText(cfg, '/about/status');
    res.json(parseModuleStatus(html));
  } catch (e) {
    next(e);
  }
});

function decodeFontsText(buf: Buffer): string {
  // GeoServer на Windows отдаёт /rest/fonts в кодировке локали (CP1251 для русской),
  // на Linux — UTF-8. Пробуем строгий UTF-8, при неудаче — CP1251.
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1251').decode(buf);
  }
}

r.get('/:id/fonts', async (req, res, next) => {
  try {
    const conn = getConnection(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
    const cfg = cfgFor(conn.host, conn.port, conn.username, getSavedPassword(conn.id) ?? '');
    const buf = await gsBuffer(cfg, '/fonts');
    const parsed = JSON.parse(decodeFontsText(buf)) as { fonts?: string[] };
    res.json(parsed.fonts ?? []);
  } catch (e) {
    next(e);
  }
});

export default r;
