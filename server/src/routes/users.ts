import { Router } from 'express';
import { requireAdmin } from '../auth';
import { hashPassword, listUsers, createUser, updateUser, deleteUser, getUserById, getUserByLogin } from '../sqlite';

const r = Router();
r.use(requireAdmin);

function countAdmins(): number {
  return listUsers().filter((u) => u.role === 'admin').length;
}

r.get('/', (_req, res) => {
  res.json(listUsers());
});

r.post('/', (req, res) => {
  const { fio, login, password, role } = (req.body ?? {}) as Record<string, unknown>;
  if (!fio || !login || !password) {
    return res.status(400).json({ error: 'Заполните ФИО, логин и пароль' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });
  }
  if (getUserByLogin(String(login).trim())) {
    return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
  }
  const u = createUser(String(fio).trim(), String(login).trim(), hashPassword(String(password)), role === 'admin' ? 'admin' : 'user');
  res.status(201).json(u);
});

r.put('/:id', (req, res) => {
  const { fio, password, role } = (req.body ?? {}) as Record<string, unknown>;
  const cur = getUserById(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Пользователь не найден' });

  if ((role === 'user') && cur.role === 'admin' && countAdmins() <= 1) {
    return res.status(400).json({ error: 'Нельзя снять роль у последнего администратора' });
  }

  const data: { fio?: string; passwordHash?: string; role?: 'admin' | 'user' } = {};
  if (fio) data.fio = String(fio);
  if (typeof password === 'string' && password) data.passwordHash = hashPassword(password);
  if (role === 'admin' || role === 'user') data.role = role;

  const u = updateUser(req.params.id, data);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(u);
});

r.delete('/:id', (req, res) => {
  const cur = getUserById(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Пользователь не найден' });
  if (cur.role === 'admin' && countAdmins() <= 1) {
    return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
  }
  deleteUser(req.params.id);
  res.json({ ok: true });
});

export default r;
