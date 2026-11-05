import { Router } from 'express';
import { requireAdmin } from '../auth';
import { logMessage, listMessages, clearMessages } from '../sqlite';

const r = Router();

// логирование всплывающего сообщения (доступно любому авторизованному)
r.post('/', (req, res) => {
  const { type, text } = (req.body ?? {}) as { type?: string; text?: string };
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Пустое сообщение' });
  const t = type === 'error' ? 'error' : type === 'info' ? 'info' : 'success';
  logMessage(t, String(text), req.user?.id ?? null, req.user?.login ?? null);
  res.json({ ok: true });
});

r.get('/', requireAdmin, (_req, res) => {
  res.json(listMessages());
});

r.delete('/', requireAdmin, (_req, res) => {
  clearMessages();
  res.json({ ok: true });
});

export default r;
