import express, { type Request, type Response, type NextFunction, type Router } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { initDb, getConnection } from './sqlite';
import connectionsRouter from './routes/connections';
import infoRouter from './routes/info';
import layersRouter from './routes/layers';
import stylesRouter from './routes/styles';
import workspacesRouter from './routes/workspaces';
import storesRouter from './routes/stores';
import layergroupsRouter from './routes/layergroups';
import cloneRouter from './routes/clone';
import gwcRouter from './routes/gwc';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import messagesRouter from './routes/messages';
import { requireAuth } from './auth';
import { logError, logInfo, logFilePath } from './logger';

initDb(config.sqlitePath);

const app = express();
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: '1mb' }));

// Все маршруты (API + статика SPA) собираются на одном роутере,
// который монтируется под базовым путём (config.basePath, напр. '/geo_man').
const root: Router = express.Router();

root.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

root.use('/api/auth', authRouter);
root.use('/api', requireAuth);
root.use('/api/users', usersRouter);
root.use('/api/messages', messagesRouter);

// проверка владения подключением для всех /api/connections/:connId/*
root.use('/api/connections/:connId', (req, res, next) => {
  const conn = getConnection(req.params.connId);
  if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
  if (req.user!.role !== 'admin' && conn.user_id !== req.user!.id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  next();
});

root.use('/api/connections', connectionsRouter);
root.use('/api/connections', infoRouter);
root.use('/api/connections', layersRouter);
root.use('/api/connections', stylesRouter);
root.use('/api/connections', workspacesRouter);
root.use('/api/connections', storesRouter);
root.use('/api/connections', layergroupsRouter);
root.use('/api/connections', cloneRouter);
root.use('/api/connections', gwcRouter);

// раздача собранного клиента (production)
const clientDist = path.resolve(__dirname, '../../client/dist');
root.use(express.static(clientDist));
root.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  const file = path.join(clientDist, 'index.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  next();
});

// монтируем всё под базовым путём (или в корень, если путь не задан)
app.use(config.basePath || '/', root);

// редирект с корня на базовый путь (удобство при заходе на «/»)
if (config.basePath) {
  app.get('/', (_req, res) => res.redirect(config.basePath + '/'));
}

app.use((err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || 500;
  logError(err, { method: req.method, url: req.originalUrl });
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Внутренняя ошибка' });
});

app.listen(config.port, config.host, () => {
  const baseUrl = `http://${config.host}:${config.port}${config.basePath}`;
  console.log(`[geo_man] server listening on ${baseUrl}`);
  console.log(`[geo_man] sqlite: ${config.sqlitePath}`);
  logInfo(`server listening on ${baseUrl} (basePath: '${config.basePath || '/'}')`);
  logInfo(`log file: ${logFilePath()}`);
});
