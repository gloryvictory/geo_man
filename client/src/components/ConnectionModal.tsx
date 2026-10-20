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
  scheme: 'http',
};

function parseGeoServerUrl(raw: string): { scheme: string; host: string; port: number } | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `http://${s}`);
    return {
      scheme: u.protocol === 'https:' ? 'https' : 'http',
      host: u.hostname,
      port: u.port ? Number(u.port) : 8080,
    };
  } catch {
    return null;
  }
}

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
      ? {
          name: initial.name,
          host: initial.host,
          port: initial.port,
          username: initial.username,
          password: '',
          scheme: initial.scheme ?? 'http',
        }
      : empty
  );
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  function fillFromUrl() {
    const parsed = parseGeoServerUrl(url);
    if (!parsed) {
      toast.error('Не удалось разобрать URL');
      return;
    }
    setForm((f) => ({ ...f, scheme: parsed.scheme, host: parsed.host, port: parsed.port }));
    toast.success('Заполнено из URL');
  }

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
          scheme: form.scheme,
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
        scheme: form.scheme,
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Изменить подключение' : 'Новое подключение'} width={480}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="URL GeoServer" description="Вставьте URL — заполнит протокол, хост и порт">
          <div className="flex gap-2">
            <Input placeholder="https://example.com:8443/geoserver" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button type="button" onClick={fillFromUrl}>
              Заполнить
            </Button>
          </div>
        </Field>

        <Field label="Название">
          <Input
            required
            placeholder="Локальный GeoServer"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <div className="flex gap-2">
          <div className="w-[110px]">
            <Field label="Протокол">
              <select
                className="input"
                value={form.scheme}
                onChange={(e) => setForm({ ...form, scheme: e.target.value })}
              >
                <option value="http">http</option>
                <option value="https">https</option>
              </select>
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Хост">
              <Input required value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
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
