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
  dataDirectory: string;
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

export interface GeoWorkspace {
  name: string;
  isolated: boolean;
  dateCreated: string | null;
  dateModified: string | null;
  href: string;
  error?: string;
}

export interface WorkspaceDetail extends GeoWorkspace {
  dataStores: string[];
}

export interface GeoStore {
  name: string;
  workspace: string;
  storeType: 'data' | 'coverage' | 'wms';
  type: string | null;
  enabled: boolean;
  description: string | null;
  dateCreated: string | null;
  dateModified: string | null;
  href: string;
  error?: string;
}

export interface GeoLayerGroup {
  name: string;
  workspace: string | null;
  mode: string | null;
  title: string | null;
  layers: string[];
  styles: string[];
  layerCount: number;
  href: string;
  error?: string;
}

export interface LayerAnalyticsRow {
  l_name: string;
  l_title: string;
  l_projection: string;
  w_name: string;
  w_name_full: string;
  s_name: string;
  s_host: string;
  s_port: string;
  s_database: string;
  s_schema: string;
  s_native_name: string;
  s_user: string;
  s_dbtype: string;
  s_native_srs: string;
}

export interface ManifestEntry {
  name: string;
  title: string;
  version: string;
}

export interface ModuleStatus {
  name: string;
  module: string;
  component: string;
  version: string;
  enabled: boolean;
  available: boolean;
  message: string;
}
