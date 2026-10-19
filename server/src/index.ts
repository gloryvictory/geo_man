import express, { type Request, type Response, type NextFunction } from 'express';
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
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import { requireAuth } from './auth';

initDb(config.sqlitePath);

const app = express();
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api', requireAuth);

// проверка владения подключением для всех /api/connections/:connId/*
app.use('/api/connections/:connId', (req, res, next) => {
  const conn = getConnection(req.params.connId);
  if (!conn) return res.status(404).json({ error: 'Подключение не найдено' });
  if (req.user!.role !== 'admin' && conn.user_id !== req.user!.id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  next();
});

app.use('/api/connections', connectionsRouter);
app.use('/api/connections', infoRouter);
app.use('/api/connections', layersRouter);
app.use('/api/connections', stylesRouter);
app.use('/api/connections', workspacesRouter);
app.use('/api/connections', storesRouter);
app.use('/api/connections', layergroupsRouter);
app.use('/api/connections', cloneRouter);

// раздача собранного клиента (production)
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  const file = path.join(clientDist, 'index.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  next();
});

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Внутренняя ошибка' });
});

app.listen(config.port, config.host, () => {
  console.log(`[geo_man] server listening on http://${config.host}:${config.port}`);
  console.log(`[geo_man] sqlite: ${config.sqlitePath}`);
});
