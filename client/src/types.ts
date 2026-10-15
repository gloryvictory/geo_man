export interface StoredConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  created_at: string;
  hasPassword: boolean;
}

export interface User {
  id: string;
  fio: string;
  login: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface GeoModule {
  name: string;
  version: string;
}

export interface GeoInfo {
  version: string;
  buildTimestamp: string;
  gitRevision: string;
  modules: GeoModule[];
  workspaceCount: number;
  layerCount: number;
  styleCount: number;
  workspaces: string[];
}

export interface GeoLayer {
  name: string;
  workspace: string;
  layer: string;
  type: string | null;
  defaultStyle: string | null;
  resourceClass: string | null;
  resourceName: string | null;
  availableStyles: string[];
  href: string;
  error?: string;
}

export interface LayerDetail extends GeoLayer {
  attribution?: unknown;
}

export interface GeoStyle {
  name: string;
  workspace: string | null;
  format: string;
  version: string;
  filename: string;
  href: string;
  error?: string;
}

export interface GeoStyleDetail extends GeoStyle {
  sld: string;
}
