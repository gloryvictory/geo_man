import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

interface ClientConfig {
  host?: string;
  port?: number;
  apiProxy?: string;
  basePath?: string;
}

function loadConfig(): { client?: ClientConfig } {
  const candidates = [path.resolve(process.cwd(), '../config.json'), path.resolve(process.cwd(), 'config.json')];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch (e) {
        console.warn('[vite] не удалось прочитать config.json:', (e as Error).message);
      }
    }
  }
  return {};
}

const cfg = loadConfig();
const client = cfg.client ?? {};

// нормализуем базовый путь к виду «/geo_man» (ведущий слэш, без хвостового)
const basePath = client.basePath ? '/' + client.basePath.replace(/^\/+|\/+$/g, '') : '';

export default defineConfig({
  plugins: [react()],
  base: basePath ? basePath + '/' : '/',
  server: {
    host: client.host ?? '127.0.0.1',
    port: Number(client.port ?? 5006),
    proxy: {
      [`${basePath}/api`]: {
        target: client.apiProxy ?? 'http://127.0.0.1:3006',
        changeOrigin: true,
        // префикс НЕ снимаем: бэкенд сам обслуживает basePath (/geo_man/api/*)
      },
    },
  },
});
