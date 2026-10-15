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
