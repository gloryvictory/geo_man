import { Router } from 'express';
import type { Request } from 'express';
import {
  listConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  savePassword,
  getSavedPassword,
  hasSavedPassword,
  type StoredConnection,
} from '../sqlite';
import { gsJson, type GeoServerConfig } from '../geoserver';

const r = Router();

function maskConnection(c: StoredConnection): Record<string, unknown> {
  const { user_id: _uid, ...rest } = c;
  return { ...rest, hasPassword: hasSavedPassword(c.id) };
}

function isAdmin(req: Request): boolean {
  return req.user?.role === 'admin';
}

function ownConn(req: Request, id: string): { conn?: StoredConnection; status?: number } {
  const conn = getConnection(id);
  if (!conn) return { status: 404 };
  if (!isAdmin(req) && conn.user_id !== req.user?.id) return { status: 403 };
  return { conn };
}

function cfgFor(conn: StoredConnection): GeoServerConfig {
  return {
    host: conn.host,
    port: conn.port,
    username: conn.username,
    password: getSavedPassword(conn.id) ?? '',
    scheme: conn.scheme ?? 'http',
  };
}

// 0 = «без порта» (порт протокола по умолчанию); отсутствие/пустое → 8080 (по умолчанию GeoServer)
function parsePort(v: unknown): number {
  if (v === undefined || v === null || v === '') return 8080;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 65535 ? n : 8080;
}

async function testGeoServer(cfg: GeoServerConfig): Promise<{ connected: boolean; error?: string }> {
  try {
    await gsJson(cfg, '/about/version.json');
    return { connected: true };
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : 'Ошибка' };
  }
}

r.get('/', (req, res) => {
  res.json(listConnections(req.user!.id, isAdmin(req)).map(maskConnection));
});

r.post('/', async (req, res, next) => {
  try {
    const { name, host, username = 'admin', password = 'geoserver', scheme = 'http' } = (req.body ?? {}) as Record<string, unknown>;
    const port = parsePort((req.body ?? {}).port);
    if (!name || !host) {
      return res.status(400).json({ error: 'Заполните name и host' });
    }
    const conn = createConnection(
      {
        name: String(name),
        host: String(host),
        port,
        username: String(username || 'admin'),
        scheme: scheme === 'https' ? 'https' : 'http',
      },
      req.user!.id
    );
    savePassword(conn.id, typeof password === 'string' && password ? password : 'geoserver');
    const test = await testGeoServer(cfgFor(conn));
    res.status(201).json({ ...maskConnection(conn), connected: test.connected, error: test.error });
  } catch (e) {
    next(e);
  }
});

r.put('/:id', async (req, res, next) => {
  try {
    const { conn, status } = ownConn(req, req.params.id);
    if (!conn) return res.status(status!).json({ error: status === 403 ? 'Нет доступа' : 'Подключение не найдено' });

    const { name, host, port, username, password, scheme } = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<Pick<StoredConnection, 'name' | 'host' | 'port' | 'username' | 'scheme'>> = {};
    if (name) patch.name = String(name);
    if (host) patch.host = String(host);
    if (port !== undefined && port !== null && port !== '') patch.port = parsePort(port);
    if (username) patch.username = String(username);
    if (scheme) patch.scheme = scheme === 'https' ? 'https' : 'http';

    const updated = updateConnection(req.params.id, patch);
    if (!updated) return res.status(404).json({ error: 'Подключение не найдено' });
    if (typeof password === 'string' && password) {
      savePassword(updated.id, password);
    }
    res.json(maskConnection(updated));
  } catch (e) {
    next(e);
  }
});

r.delete('/:id', (req, res) => {
  const { conn, status } = ownConn(req, req.params.id);
  if (!conn) return res.status(status!).json({ error: status === 403 ? 'Нет доступа' : 'Подключение не найдено' });
  deleteConnection(req.params.id);
  res.json({ ok: true });
});

r.post('/:id/test', async (req, res) => {
  const { conn, status } = ownConn(req, req.params.id);
  if (!conn) return res.status(status!).json({ error: status === 403 ? 'Нет доступа' : 'Подключение не найдено' });
  const test = await testGeoServer(cfgFor(conn));
  res.json({ connected: test.connected, error: test.error });
});

export default r;
