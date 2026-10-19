import { Buffer } from 'node:buffer';

export interface GeoServerConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export class GeoServerError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** REST-корень GeoServer. Контекстный путь по умолчанию — /geoserver. */
export function gsBaseUrl(cfg: GeoServerConfig): string {
  const host = cfg.host.replace(/\/+$/, '');
  return `http://${host}:${cfg.port}/geoserver/rest`;
}

function friendlyStatus(status: number): string {
  switch (status) {
    case 0:
      return 'GeoServer недоступен';
    case 401:
      return 'Ошибка аутентификации GeoServer — проверьте логин и пароль';
    case 403:
      return 'Доступ к ресурсу GeoServer запрещён';
    case 404:
      return 'Ресурс GeoServer не найден';
    case 500:
      return 'Внутренняя ошибка GeoServer';
    default:
      return `GeoServer вернул HTTP ${status}`;
  }
}

/** fetch к GeoServer с Basic Auth. Единственная точка входа к REST. */
export async function gsFetch(cfg: GeoServerConfig, path: string, init?: RequestInit): Promise<Response> {
  const auth = Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64');
  let res: Response;
  try {
    res = await fetch(gsBaseUrl(cfg) + path, {
      ...init,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    throw new GeoServerError(`Не удалось связаться с GeoServer: ${(e as Error).message}`, 0);
  }
  if (!res.ok) {
    throw new GeoServerError(friendlyStatus(res.status), res.status);
  }
  return res;
}

export async function gsJson<T = unknown>(cfg: GeoServerConfig, path: string): Promise<T> {
  const res = await gsFetch(cfg, path);
  return (await res.json()) as T;
}

export async function gsText(cfg: GeoServerConfig, path: string): Promise<string> {
  const res = await gsFetch(cfg, path, { headers: { Accept: '*/*' } });
  return res.text();
}

/** Сырые байты ответа (для нестандартных кодировок, напр. /fonts в CP1251). */
export async function gsBuffer(cfg: GeoServerConfig, path: string): Promise<Buffer> {
  const res = await gsFetch(cfg, path);
  return Buffer.from(await res.arrayBuffer());
}

function extractJSessionId(setCookie: string | null): string {
  if (!setCookie) return '';
  const m = setCookie.match(/JSESSIONID=([^;]+)/);
  return m ? m[1] : '';
}

/**
 * Каталог данных GeoServer. REST не отдаёт этот путь напрямую —
 * получаем через веб-интерфейс (Wicket StatusPage) с form login.
 */
export async function gsDataDirectory(cfg: GeoServerConfig): Promise<string> {
  const host = cfg.host.replace(/\/+$/, '');
  const base = `http://${host}:${cfg.port}/geoserver`;

  let session = '';
  const r1 = await fetch(`${base}/web/`, { redirect: 'manual' });
  session = extractJSessionId(r1.headers.get('set-cookie'));

  const r2 = await fetch(`${base}/j_spring_security_check`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(session ? { Cookie: `JSESSIONID=${session}` } : {}),
    },
    body: `username=${encodeURIComponent(cfg.username)}&password=${encodeURIComponent(cfg.password)}`,
  });
  session = extractJSessionId(r2.headers.get('set-cookie')) || session;

  const r3 = await fetch(`${base}/web/wicket/bookmarkable/org.geoserver.web.admin.StatusPage`, {
    redirect: 'follow',
    headers: session ? { Cookie: `JSESSIONID=${session}` } : {},
  });
  const html = await r3.text();

  const re = /<th[^>]*>\s*(?:Каталог данных|Data directory|Data Directory)\s*<\/th>\s*<td[^>]*>([^<]*)<\/td>/i;
  const m = html.match(re);
  return m ? m[1].trim().replace(/&amp;/g, '&') : '';
}

/** GeoServer отдаёт одиночный элемент без массива — всегда оборачивать. */
export function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

/** Ограниченный параллелизм для массовых запросов (детали слоёв/стилей). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Легенда стиля через WMS GetLegendGraphic (возвращает PNG). */
export async function gsLegendPng(cfg: GeoServerConfig, layer: string, style: string, width = 20, height = 20): Promise<Buffer> {
  const host = cfg.host.replace(/\/+$/, '');
  const url =
    `http://${host}:${cfg.port}/geoserver/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=${width}&HEIGHT=${height}` +
    `&LAYER=${encodeURIComponent(layer)}&STYLE=${encodeURIComponent(style)}`;
  const auth = Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64');
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  } catch (e) {
    throw new GeoServerError(`Не удалось связаться с GeoServer: ${(e as Error).message}`, 0);
  }
  const ct = res.headers.get('content-type') || '';
  if (res.ok && ct.includes('image/png')) {
    return Buffer.from(await res.arrayBuffer());
  }
  if (!res.ok) {
    throw new GeoServerError(friendlyStatus(res.status), res.status);
  }
  throw new GeoServerError('Не удалось сгенерировать легенду стиля', 502);
}
