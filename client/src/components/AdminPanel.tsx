import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { Modal, Field, Input, Button } from './ui';
import type { User } from '../types';

export default function AdminPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fio: '', login: '', password: '', role: 'user' as 'admin' | 'user' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (open) reload();
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

  return (
    <Modal open={open} onClose={onClose} title="Админка — пользователи" width={560}>
      <form onSubmit={save} className="mb-4 flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
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
    </Modal>
  );
}
