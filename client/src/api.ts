import type { StoredConnection, User, GeoInfo, GeoLayer, LayerDetail, GeoStyle, GeoStyleDetail, GeoWorkspace, WorkspaceDetail, GeoStore, GeoLayerGroup, LayerAnalyticsRow, ManifestEntry, ModuleStatus, GeoServerSettings } from './types';

const BASE_URL = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
const BASE = BASE_URL + '/api';
const enc = encodeURIComponent;

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface CreateConnRes extends StoredConnection {
  connected: boolean;
  error?: string;
}

export const api = {
  health: () => http<{ status: string; time: string }>('/health'),

  // подключения
  listConnections: () => http<StoredConnection[]>('/connections'),
  createConnection: (d: Record<string, unknown>) =>
    http<CreateConnRes>('/connections', { method: 'POST', body: JSON.stringify(d) }),
  updateConnection: (id: string, d: Record<string, unknown>) =>
    http<StoredConnection>(`/connections/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteConnection: (id: string) => http<{ ok: boolean }>(`/connections/${id}`, { method: 'DELETE' }),
  testConnection: (id: string) => http<{ connected: boolean; error?: string }>(`/connections/${id}/test`, { method: 'POST' }),

  // GeoServer
  info: (id: string) => http<GeoInfo>(`/connections/${id}/info`),
  layers: (id: string) => http<GeoLayer[]>(`/connections/${id}/layers`),
  layerDetail: (id: string, name: string) => http<LayerDetail>(`/connections/${id}/layers/${enc(name)}`),
  layersAnalytics: (id: string) => http<LayerAnalyticsRow[]>(`/connections/${id}/layers/analytics`),
  manifest: (id: string) => http<ManifestEntry[]>(`/connections/${id}/manifest`),
  modules: (id: string) => http<ModuleStatus[]>(`/connections/${id}/modules`),
  fonts: (id: string) => http<string[]>(`/connections/${id}/fonts`),
  settings: (id: string) => http<GeoServerSettings>(`/connections/${id}/settings`),
  styles: (id: string) => http<GeoStyle[]>(`/connections/${id}/styles`),
  styleDetail: (id: string, name: string) => http<GeoStyleDetail>(`/connections/${id}/styles/${enc(name)}`),
  workspaces: (id: string) => http<GeoWorkspace[]>(`/connections/${id}/workspaces`),
  workspaceDetail: (id: string, name: string) => http<WorkspaceDetail>(`/connections/${id}/workspaces/${enc(name)}`),
  stores: (id: string) => http<GeoStore[]>(`/connections/${id}/stores`),
  layergroups: (id: string) => http<GeoLayerGroup[]>(`/connections/${id}/layergroups`),
  clone: (sourceId: string, body: { targetId: string; type: string; names: string[] }) =>
    http<{ results: { name: string; ok: boolean; error?: string }[] }>(`/connections/${sourceId}/clone`, { method: 'POST', body: JSON.stringify(body) }),
  stylesExportUrl: (id: string) => `${BASE}/connections/${id}/styles/export`,
  stylesLegendUrl: (id: string, name: string, width?: number, height?: number) => {
    let url = `${BASE}/connections/${id}/styles/${enc(name)}/legend`;
    const p: string[] = [];
    if (width) p.push(`width=${width}`);
    if (height) p.push(`height=${height}`);
    if (p.length) url += '?' + p.join('&');
    return url;
  },

  // аутентификация
  login: (login: string, password: string) =>
    http<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  register: (fio: string, login: string, password: string) =>
    http<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ fio, login, password }) }),
  logout: () => http<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => http<{ user: User }>('/auth/me'),

  // пользователи (админ)
  listUsers: () => http<User[]>('/users'),
  createUser: (d: { fio: string; login: string; password: string; role?: 'admin' | 'user' }) =>
    http<User>('/users', { method: 'POST', body: JSON.stringify(d) }),
  updateUser: (id: string, d: { fio?: string; password?: string; role?: 'admin' | 'user' }) =>
    http<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteUser: (id: string) => http<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
};
