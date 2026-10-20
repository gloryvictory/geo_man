import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { useStore } from '../store';
import { Modal, Field, Input, Button, Tabs } from './ui';
import type { User, StoredConnection } from '../types';

function parseGeoServerUrl(raw: string): { scheme: string; host: string; port: number } | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `http://${s}`);
    return {
      scheme: u.protocol === 'https:' ? 'https' : 'http',
      host: u.hostname,
      port: u.port ? Number(u.port) : 0,
    };
  } catch {
    return null;
  }
}

const emptyConn = {
  name: '',
  scheme: 'http',
  host: 'localhost',
  port: 8080,
  username: 'admin',
  password: 'geoserver',
};

export default function AdminPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const [tab, setTab] = useState<'users' | 'connections'>('users');

  // — пользователи —
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fio: '', login: '', password: '', role: 'user' as 'admin' | 'user' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // — подключения —
  const [connForm, setConnForm] = useState(emptyConn);
  const [connUrl, setConnUrl] = useState('');
  const [connEditingId, setConnEditingId] = useState<string | null>(null);
  const [connSaving, setConnSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setUsers(await api.listUsers());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      reload();
      store.loadConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function startEdit(u: User) {
    setEditingId(u.id);
    setForm({ fio: u.fio, login: u.login, password: '', role: u.role });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ fio: '', login: '', password: '', role: 'user' });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.updateUser(editingId, {
          fio: form.fio,
          ...(form.password ? { password: form.password } : {}),
          role: form.role,
        });
        toast.success('Пользователь обновлён');
      } else {
        await api.createUser(form);
        toast.success('Пользователь создан');
      }
      resetForm();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  async function remove(u: User) {
    if (!window.confirm(`Удалить пользователя «${u.login}»?`)) return;
    try {
      await api.deleteUser(u.id);
      toast.success('Пользователь удалён');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  // — подключения —
  function connFillFromUrl() {
    const parsed = parseGeoServerUrl(connUrl);
    if (!parsed) {
      toast.error('Не удалось разобрать URL');
      return;
    }
    setConnForm((f) => ({ ...f, scheme: parsed.scheme, host: parsed.host, port: parsed.port }));
  }

  function connStartEdit(c: StoredConnection) {
    setConnEditingId(c.id);
    setConnForm({
      name: c.name,
      scheme: c.scheme ?? 'http',
      host: c.host,
      port: c.port,
      username: c.username,
      password: '',
    });
  }

  function connReset() {
    setConnEditingId(null);
    setConnUrl('');
    setConnForm(emptyConn);
  }

  async function connSave(e: React.FormEvent) {
    e.preventDefault();
    setConnSaving(true);
    try {
      if (connEditingId) {
        await store.updateConnection(connEditingId, {
          name: connForm.name,
          host: connForm.host,
          port: connForm.port,
          username: connForm.username,
          scheme: connForm.scheme,
          ...(connForm.password ? { password: connForm.password } : {}),
        });
        toast.success('Подключение обновлено');
      } else {
        const res = await store.addConnection({
          name: connForm.name,
          host: connForm.host,
          port: connForm.port,
          username: connForm.username,
          password: connForm.password,
          scheme: connForm.scheme,
        });
        if (res.ok && res.connected) toast.success('Добавлено и подключено');
        else if (res.ok) toast.error(`Сохранено, но подключение не удалось: ${res.error || 'ошибка'}`);
        else toast.error(res.error || 'Ошибка сохранения');
      }
      connReset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setConnSaving(false);
    }
  }

  async function connRemove(c: StoredConnection) {
    if (!window.confirm(`Удалить подключение «${c.name}»?`)) return;
    try {
      await store.removeConnection(c.id);
      toast.success('Подключение удалено');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function connTest(c: StoredConnection) {
    setTestingId(c.id);
    try {
      const r = await api.testConnection(c.id);
      if (r.connected) toast.success('Подключение работает');
      else toast.error(`Не подключается: ${r.error || 'неизвестно'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setTestingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Админка" width={720}>
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as 'users' | 'connections')}
        items={[
          { value: 'users', label: 'Пользователи' },
          { value: 'connections', label: 'Подключения' },
        ]}
      />

      {tab === 'users' ? (
        <div className="flex flex-col gap-3 pt-3">
          <form onSubmit={save} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
            <div className="text-[12px] font-medium text-[var(--muted)]">
              {editingId ? `Изменение: ${form.login}` : 'Новый пользователь'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="ФИО">
                <Input value={form.fio} onChange={(e) => setForm({ ...form, fio: e.target.value })} required />
              </Field>
              <Field label="Логин">
                <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required disabled={!!editingId} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={editingId ? 'Пароль (пусто — не менять)' : 'Пароль'}>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} />
              </Field>
              <Field label="Роль">
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'user' })}
                >
                  <option value="user">Пользователь</option>
                  <option value="admin">Администратор</option>
                </select>
              </Field>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? '…' : editingId ? 'Сохранить' : 'Создать'}
              </Button>
              {editingId && (
                <Button type="button" onClick={resetForm}>
                  Отмена
                </Button>
              )}
            </div>
          </form>

          <div className="overflow-auto">
            {loading ? (
              <div className="py-4 text-center text-[12px] text-[var(--faint)]">Загрузка…</div>
            ) : (
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--faint)]">
                    <th className="py-1.5 pr-2 font-medium">Логин</th>
                    <th className="py-1.5 pr-2 font-medium">ФИО</th>
                    <th className="py-1.5 pr-2 font-medium">Роль</th>
                    <th className="py-1.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5 pr-2 font-mono">{u.login}</td>
                      <td className="py-1.5 pr-2">{u.fio}</td>
                      <td className="py-1.5 pr-2">
                        <span className={`badge ${u.role === 'admin' ? 'pk' : 'kind'}`}>{u.role}</span>
                      </td>
                      <td className="py-1.5 text-right">
                        <Button variant="subtle" size="xs" onClick={() => startEdit(u)}>
                          Изменить
                        </Button>
                        <Button variant="subtle" size="xs" onClick={() => remove(u)}>
                          Удалить
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-3">
          <form onSubmit={connSave} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
            <div className="text-[12px] font-medium text-[var(--muted)]">
              {connEditingId ? `Изменение: ${connForm.name}` : 'Новое подключение'}
            </div>
            <Field label="URL GeoServer" description="Вставьте URL — заполнит протокол, хост и порт">
              <div className="flex gap-2">
                <Input placeholder="https://example.com:8443/geoserver" value={connUrl} onChange={(e) => setConnUrl(e.target.value)} />
                <Button type="button" onClick={connFillFromUrl}>
                  Заполнить
                </Button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Название">
                <Input required value={connForm.name} onChange={(e) => setConnForm({ ...connForm, name: e.target.value })} />
              </Field>
              <Field label="Логин">
                <Input value={connForm.username} onChange={(e) => setConnForm({ ...connForm, username: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-[110px_1fr_92px] gap-2">
              <Field label="Протокол">
                <select
                  className="input"
                  value={connForm.scheme}
                  onChange={(e) => setConnForm({ ...connForm, scheme: e.target.value })}
                >
                  <option value="http">http</option>
                  <option value="https">https</option>
                </select>
              </Field>
              <Field label="Хост">
                <Input required value={connForm.host} onChange={(e) => setConnForm({ ...connForm, host: e.target.value })} />
              </Field>
              <Field label="Порт" description="пусто — без порта">
                <Input
                  type="number"
                  min={0}
                  max={65535}
                  placeholder="8080"
                  value={connForm.port || ''}
                  onChange={(e) => setConnForm({ ...connForm, port: e.target.value === '' ? 0 : Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label={connEditingId ? 'Пароль (пусто — не менять)' : 'Пароль'}>
              <Input
                type="password"
                value={connForm.password}
                onChange={(e) => setConnForm({ ...connForm, password: e.target.value })}
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" type="submit" disabled={connSaving}>
                {connSaving ? '…' : connEditingId ? 'Сохранить' : 'Добавить'}
              </Button>
              {connEditingId && (
                <Button type="button" onClick={connReset}>
                  Отмена
                </Button>
              )}
            </div>
          </form>

          <div className="overflow-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--faint)]">
                  <th className="py-1.5 pr-2 font-medium">Название</th>
                  <th className="py-1.5 pr-2 font-medium">Адрес</th>
                  <th className="py-1.5 pr-2 font-medium">Логин</th>
                  <th className="py-1.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {store.connections.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-[12px] text-[var(--faint)]">
                      Нет подключений
                    </td>
                  </tr>
                )}
                {store.connections.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-1.5 pr-2 font-mono">{c.name}</td>
                    <td className="py-1.5 pr-2 font-mono text-[var(--muted)]">
                      {c.scheme ?? 'http'}://{c.host}{c.port ? `:${c.port}` : ''}
                    </td>
                    <td className="py-1.5 pr-2 font-mono">{c.username}</td>
                    <td className="py-1.5 text-right">
                      <Button variant="subtle" size="xs" disabled={testingId === c.id} onClick={() => connTest(c)}>
                        {testingId === c.id ? '…' : 'Проверить'}
                      </Button>
                      <Button variant="subtle" size="xs" onClick={() => connStartEdit(c)}>
                        Изменить
                      </Button>
                      <Button variant="subtle" size="xs" onClick={() => connRemove(c)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
