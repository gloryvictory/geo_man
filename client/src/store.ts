import { create } from 'zustand';
import toast from 'react-hot-toast';
import { api } from './api';
import type { StoredConnection, GeoInfo, GeoLayer, GeoStyle } from './types';

export interface GeoState {
  connections: StoredConnection[];
  activeConnId: string | null;
  connected: boolean;
  connecting: boolean;

  info: GeoInfo | null;
  layers: GeoLayer[];
  styles: GeoStyle[];
  loadingInfo: boolean;
  loadingLayers: boolean;
  loadingStyles: boolean;

  loadConnections: () => Promise<void>;
  setActiveConn: (id: string | null) => void;
  connect: (id: string) => Promise<boolean>;
  disconnect: () => void;
  addConnection: (data: {
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
  }) => Promise<{ ok: boolean; connected: boolean; id?: string; error?: string }>;
  updateConnection: (id: string, data: Record<string, unknown>) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  fetchInfo: () => Promise<void>;
  fetchLayers: () => Promise<void>;
  fetchStyles: () => Promise<void>;
  reset: () => void;
}

export const useStore = create<GeoState>((set, get) => ({
  connections: [],
  activeConnId: null,
  connected: false,
  connecting: false,
  info: null,
  layers: [],
  styles: [],
  loadingInfo: false,
  loadingLayers: false,
  loadingStyles: false,

  loadConnections: async () => {
    const conns = await api.listConnections();
    set({ connections: conns });
  },

  setActiveConn: (id) =>
    set({ activeConnId: id, connected: false, info: null, layers: [], styles: [] }),

  connect: async (id) => {
    set({ connecting: true, activeConnId: id, connected: false, info: null, layers: [], styles: [] });
    try {
      const r = await api.testConnection(id);
      if (r.connected) {
        set({ connected: true, connecting: false });
        localStorage.setItem('geoman-last-conn', id);
        await Promise.allSettled([get().fetchInfo(), get().fetchLayers(), get().fetchStyles()]);
        return true;
      }
      set({ connecting: false });
      toast.error(r.error || 'Не удалось подключиться');
      return false;
    } catch (e) {
      set({ connecting: false });
      toast.error(e instanceof Error ? e.message : 'Не удалось подключиться');
      return false;
    }
  },

  disconnect: () =>
    set({ connected: false, info: null, layers: [], styles: [] }),

  addConnection: async (data) => {
    try {
      const res = await api.createConnection(data);
      await get().loadConnections();
      set({ activeConnId: res.id, connected: !!res.connected });
      if (res.connected) localStorage.setItem('geoman-last-conn', res.id);
      return { ok: true, connected: !!res.connected, id: res.id, error: res.error };
    } catch (e) {
      return { ok: false, connected: false, error: e instanceof Error ? e.message : 'Ошибка' };
    }
  },

  updateConnection: async (id, data) => {
    await api.updateConnection(id, data);
    await get().loadConnections();
  },

  removeConnection: async (id) => {
    await api.deleteConnection(id);
    if (get().activeConnId === id) {
      set({ activeConnId: null, connected: false, info: null, layers: [], styles: [] });
    }
    if (localStorage.getItem('geoman-last-conn') === id) localStorage.removeItem('geoman-last-conn');
    await get().loadConnections();
  },

  fetchInfo: async () => {
    const id = get().activeConnId;
    if (!id) return;
    set({ loadingInfo: true });
    try {
      const info = await api.info(id);
      set({ info, loadingInfo: false });
    } catch (e) {
      set({ loadingInfo: false });
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки информации');
    }
  },

  fetchLayers: async () => {
    const id = get().activeConnId;
    if (!id) return;
    set({ loadingLayers: true });
    try {
      const layers = await api.layers(id);
      set({ layers, loadingLayers: false });
    } catch (e) {
      set({ loadingLayers: false });
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки слоёв');
    }
  },

  fetchStyles: async () => {
    const id = get().activeConnId;
    if (!id) return;
    set({ loadingStyles: true });
    try {
      const styles = await api.styles(id);
      set({ styles, loadingStyles: false });
    } catch (e) {
      set({ loadingStyles: false });
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки стилей');
    }
  },

  reset: () =>
    set({
      connections: [],
      activeConnId: null,
      connected: false,
      connecting: false,
      info: null,
      layers: [],
      styles: [],
      loadingInfo: false,
      loadingLayers: false,
      loadingStyles: false,
    }),
}));
