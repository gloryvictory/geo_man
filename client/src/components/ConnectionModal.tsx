import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import { Modal, Field, Input, Button } from './ui';
import type { StoredConnection } from '../types';

const empty = {
  name: '',
  host: 'localhost',
  port: 8080,
  username: 'admin',
  password: 'geoserver',
};

export default function ConnectionModal({
  open,
  onClose,
  initial = null,
}: {
  open: boolean;
  onClose: () => void;
  initial?: StoredConnection | null;
}) {
  const store = useStore();
  const isEdit = !!initial;
  const [form, setForm] = useState(() =>
    initial
      ? { name: initial.name, host: initial.host, port: initial.port, username: initial.username, password: '' }
      : empty
  );
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await store.updateConnection(initial!.id, {
          name: form.name,
          host: form.host,
          port: form.port,
          username: form.username,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.success('Подключение обновлено');
        onClose();
        return;
      }
      const res = await store.addConnection({
        name: form.name,
        host: form.host,
        port: form.port,
        username: form.username,
        password: form.password,
      });
      if (res.ok && res.connected) {
        toast.success('Подключено');
        if (res.id) await store.connect(res.id);
        onClose();
        setForm(empty);
      } else if (res.ok) {
        toast.error(`Подключение не удалось: ${res.error || 'неизвестная ошибка'}`);
        onClose();
        setForm(empty);
      } else {
        toast.error(res.error || 'Ошибка сохранения');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Изменить подключение' : 'Новое подключение'} width={460}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Название">
          <Input
            required
            placeholder="Локальный GeoServer"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Хост">
              <Input
                required
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
            </Field>
          </div>
          <div className="w-[92px]">
            <Field label="Порт">
              <Input
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 8080 })}
              />
            </Field>
          </div>
        </div>
        <Field label="Логин">
          <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </Field>
        <Field
          label={isEdit ? 'Пароль (пусто — не менять)' : 'Пароль'}
          description="Сохраняется в SQLite и используется для запросов к GeoServer"
        >
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Button variant="primary" type="submit" disabled={saving} className="mt-1">
          {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Добавить и подключить'}
        </Button>
      </form>
    </Modal>
  );
}
