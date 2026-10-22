import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, GitCompare, RefreshCw, ArrowRight } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Loader, Input, Button, Select, Modal, Field } from '../components/ui';

const RES_TYPES = [
  { value: 'styles', label: 'Стили' },
  { value: 'layers', label: 'Слои' },
  { value: 'workspaces', label: 'Рабочие области' },
  { value: 'stores', label: 'Хранилища' },
  { value: 'layergroups', label: 'Группы слоев' },
];

const TYPE_MAP: Record<string, string> = {
  styles: 'style',
  layers: 'layer',
  workspaces: 'workspace',
  stores: 'store',
  layergroups: 'layergroup',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nameOf(x: any): string {
  const ws = x?.workspace as string | null | undefined;
  return ws ? `${ws}:${x.name}` : x.name;
}

async function fetchNames(type: string, id: string): Promise<string[]> {
  if (type === 'styles') return (await api.styles(id)).map(nameOf);
  if (type === 'layers') return (await api.layers(id)).map(nameOf);
  if (type === 'workspaces') return (await api.workspaces(id)).map((x) => x.name);
  if (type === 'stores') return (await api.stores(id)).map(nameOf);
  if (type === 'layergroups') return (await api.layergroups(id)).map(nameOf);
  return [];
}

export default function Clone() {
  const { connections, loadConnections } = useStore();
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [resType, setResType] = useState('styles');
  const [sourceItems, setSourceItems] = useState<string[]>([]);
  const [targetItems, setTargetItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [search, setSearch] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyAsOpen, setCopyAsOpen] = useState(false);
  const [copyAsValue, setCopyAsValue] = useState('');
  const [copyingAs, setCopyingAs] = useState(false);

  const connOptions = connections.map((c) => ({ value: c.id, label: `${c.name} — ${c.host}:${c.port}` }));

  useEffect(() => {
    if (connections.length === 0) loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // автовыбор источника/цели при наличии >= 2 подключений
  useEffect(() => {
    if (connections.length >= 2) {
      if (!sourceId) setSourceId(connections[0].id);
      if (!targetId) setTargetId(connections[1].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  async function load() {
    if (!sourceId || !targetId) return;
    setLoading(true);
    try {
      const [s, t] = await Promise.all([fetchNames(resType, sourceId), fetchNames(resType, targetId)]);
      setSourceItems(s);
      setTargetItems(t);
      setSelected(new Set());
      setCompareMode(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sourceId && targetId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, targetId, resType]);

  const targetSet = useMemo(() => new Set(targetItems), [targetItems]);
  const sourceSet = useMemo(() => new Set(sourceItems), [sourceItems]);

  const filteredSource = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return sourceItems;
    return sourceItems.filter((n) => n.toLowerCase().includes(s));
  }, [sourceItems, search]);

  const onlySource = useMemo(() => sourceItems.filter((n) => !targetSet.has(n)), [sourceItems, targetSet]);
  const onlyTarget = useMemo(() => targetItems.filter((n) => !sourceSet.has(n)), [targetItems, sourceSet]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === filteredSource.length && filteredSource.length > 0) return new Set();
      return new Set(filteredSource);
    });
  }

  async function doCopy() {
    if (!sourceId || !targetId || selected.size === 0) return;
    if (resType === 'layers' || resType === 'stores') {
      toast.error('Копирование этого типа ресурса пока не поддерживается');
      return;
    }
    setCopying(true);
    try {
      const res = await api.clone(sourceId, { targetId, type: TYPE_MAP[resType], names: Array.from(selected) });
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      if (fail === 0) toast.success(`Скопировано: ${ok}`);
      else toast.error(`Скопировано: ${ok}, ошибок: ${fail}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка копирования');
    } finally {
      setCopying(false);
    }
  }

  async function doCopyAs() {
    if (!sourceId || !targetId || selected.size !== 1) return;
    const name = Array.from(selected)[0];
    const newName = copyAsValue.trim();
    if (!newName) {
      toast.error('Введите новое имя');
      return;
    }
    setCopyingAs(true);
    try {
      await api.cloneAs(sourceId, { targetId, type: TYPE_MAP[resType], name, newName });
      toast.success(`Скопировано как «${newName}»`);
      setCopyAsOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка копирования');
    } finally {
      setCopyingAs(false);
    }
  }

  const supportsCopy = resType === 'styles' || resType === 'workspaces' || resType === 'layergroups';

  if (connections.length < 2) {
    return (
      <div className="grid h-full place-items-center p-4 text-center text-[13px] text-[var(--faint)]">
        <div className="max-w-[420px]">
          Для клонирования нужно минимум два подключения к GeoServer.
          <br />
          Добавьте второе подключение через кнопку «+» в шапке.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-[var(--muted)]">Источник:</span>
        <Select width={340} value={sourceId} onChange={(v) => v && setSourceId(v)} options={connOptions} searchable />
        <ArrowRight size={14} className="text-[var(--faint)]" />
        <span className="text-[12px] text-[var(--muted)]">Цель:</span>
        <Select width={340} value={targetId} onChange={(v) => v && setTargetId(v)} options={connOptions} searchable />
        <div className="flex-1" />
        <Select width={180} value={resType} onChange={(v) => v && setResType(v)} options={RES_TYPES} />
        <Button variant="subtle" onClick={load}>
          <RefreshCw size={13} />
          Обновить
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] gap-3">
        {/* Источник */}
        <div className="flex min-h-0 flex-col rounded-lg border border-[var(--border)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--faint)]">Источник</span>
            <span className="text-[12px] text-[var(--faint)]">
              {selected.size} / {sourceItems.length}
            </span>
          </div>
          <div className="border-b border-[var(--border)] px-2 py-1.5">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск…" className="w-full" />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-1.5">
            {loading ? (
              <div className="grid h-full place-items-center">
                <Loader size={24} />
              </div>
            ) : filteredSource.length === 0 ? (
              <div className="grid h-full place-items-center text-[var(--faint)]">Нет данных</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <div
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11.5px] text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                  onClick={toggleAll}
                >
                  <input type="checkbox" readOnly checked={selected.size === filteredSource.length && filteredSource.length > 0} />
                  <span>Выбрать все</span>
                </div>
                {filteredSource.map((name) => (
                  <div
                    key={name}
                    className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-[var(--surface-hover)] ${
                      compareMode && !targetSet.has(name) ? 'bg-[var(--accent-bg)]' : ''
                    }`}
                    onClick={() => toggle(name)}
                  >
                    <input type="checkbox" readOnly checked={selected.has(name)} />
                    <span className="font-mono text-[12px] text-[var(--text)]">{name}</span>
                    {compareMode && !targetSet.has(name) && (
                      <span className="ml-auto shrink-0 text-[10px] text-[var(--accent)]">нет на цели</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Средняя панель инструментов */}
        <div className="flex w-[120px] flex-col items-center justify-center gap-2">
          <Button variant="light" onClick={doCopy} disabled={selected.size === 0 || copying || !supportsCopy} title={supportsCopy ? 'Копировать выбранное' : 'Не поддерживается для этого типа'}>
            <Copy size={14} />
            Копировать
          </Button>
          <Button
            variant="subtle"
            onClick={() => {
              setCopyAsValue(Array.from(selected)[0] ?? '');
              setCopyAsOpen(true);
            }}
            disabled={selected.size !== 1 || !supportsCopy}
            title={supportsCopy ? 'Копировать выбранное под новым именем' : 'Не поддерживается для этого типа'}
          >
            <Copy size={14} />
            Копировать как…
          </Button>
          <Button variant="subtle" onClick={() => setCompareMode((v) => !v)}>
            <GitCompare size={14} />
            Сравнить
          </Button>
          {compareMode && (
            <div className="mt-1 text-center text-[11px] leading-relaxed text-[var(--faint)]">
              <div className="text-[var(--accent)]">+{onlySource.length} только в источнике</div>
              <div className="text-[var(--muted)]">+{onlyTarget.length} только в цели</div>
            </div>
          )}
        </div>

        {/* Цель */}
        <div className="flex min-h-0 flex-col rounded-lg border border-[var(--border)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--faint)]">Цель</span>
            <span className="text-[12px] text-[var(--faint)]">{targetItems.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-1.5">
            {loading ? (
              <div className="grid h-full place-items-center">
                <Loader size={24} />
              </div>
            ) : targetItems.length === 0 ? (
              <div className="grid h-full place-items-center text-[var(--faint)]">Нет данных</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {targetItems.map((name) => (
                  <div
                    key={name}
                    className={`flex items-center gap-2 rounded px-2 py-1 ${
                      compareMode && !sourceSet.has(name) ? 'bg-[var(--surface-hover)]' : ''
                    }`}
                  >
                    <span className="font-mono text-[12px] text-[var(--text)]">{name}</span>
                    {compareMode && !sourceSet.has(name) && (
                      <span className="ml-auto shrink-0 text-[10px] text-[var(--faint)]">только здесь</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={copyAsOpen} onClose={() => setCopyAsOpen(false)} title="Копировать как…" width={440}>
        <div className="flex flex-col gap-3">
          <div className="text-[12.5px] text-[var(--muted)]">
            Выбранный элемент будет скопирован в целевое подключение с новым именем.
          </div>
          <Field label="Новое имя">
            <Input
              autoFocus
              value={copyAsValue}
              onChange={(e) => setCopyAsValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doCopyAs();
              }}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setCopyAsOpen(false)}>Отмена</Button>
            <Button variant="primary" onClick={doCopyAs} disabled={copyingAs || !copyAsValue.trim()}>
              {copyingAs ? '…' : 'Копировать'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
