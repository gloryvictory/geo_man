import { useMemo, useState } from 'react';
import { RefreshCw, FileDown } from 'lucide-react';
import { useStore } from '../store';
import { Loader, Modal, Input, Button, Info, Select } from '../components/ui';
import { exportToExcel, exportToCsv } from '../lib/export';
import type { GeoStore } from '../types';

const STORE_KIND_LABEL: Record<string, string> = { data: 'Данные', coverage: 'Покрытие', wms: 'WMS' };

export default function Stores() {
  const { activeConnId, connected, stores, loadingStores, fetchStores } = useStore();
  const [q, setQ] = useState('');
  const [wsFilter, setWsFilter] = useState('');
  const [detail, setDetail] = useState<GeoStore | null>(null);

  const workspaceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of stores) if (s.workspace) set.add(s.workspace);
    return [
      { value: '', label: 'Все' },
      ...Array.from(set).sort().map((w) => ({ value: w, label: w })),
    ];
  }, [stores]);

  const filtered = useMemo(() => {
    let list = stores;
    if (wsFilter) list = list.filter((s) => s.workspace === wsFilter);
    const qs = q.trim().toLowerCase();
    if (qs) {
      list = list.filter(
        (st) =>
          st.name.toLowerCase().includes(qs) ||
          st.workspace.toLowerCase().includes(qs) ||
          (st.type ?? '').toLowerCase().includes(qs)
      );
    }
    return list;
  }, [stores, q, wsFilter]);

  function doExport(format: 'xlsx' | 'csv') {
    const header = ['Имя', 'Рабочая область', 'Вид', 'Формат', 'Включено'];
    const rows = filtered.map((s) => [
      s.name,
      s.workspace,
      STORE_KIND_LABEL[s.storeType] ?? s.storeType,
      s.type ?? '',
      s.enabled ? 'да' : 'нет',
    ]);
    if (format === 'xlsx') exportToExcel('geo_man_stores', header, rows);
    else exportToCsv('geo_man_stores', header, rows);
  }

  if (!activeConnId) {
    return <div className="grid h-full place-items-center text-[13px] text-[var(--faint)]">Добавьте подключение GeoServer.</div>;
  }
  if (!connected) {
    return <div className="grid h-full place-items-center text-[13px] text-[var(--faint)]">Нет подключения — нажмите «Подключить».</div>;
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск хранилищ…" className="max-w-[320px]" />
        <Select value={wsFilter} onChange={(v) => setWsFilter(v ?? '')} options={workspaceOptions} width={180} />
        <Button variant="subtle" onClick={() => fetchStores()}>
          <RefreshCw size={13} />
          Обновить
        </Button>
        <div className="flex-1" />
        <span className="text-[12px] text-[var(--faint)]">{filtered.length} из {stores.length}</span>
        <Button variant="subtle" onClick={() => doExport('xlsx')}>
          <FileDown size={13} />
          Excel
        </Button>
        <Button variant="subtle" onClick={() => doExport('csv')}>
          <FileDown size={13} />
          CSV
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--border)]">
        {loadingStores ? (
          <div className="grid h-full place-items-center">
            <Loader size={24} />
          </div>
        ) : (
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--bg-raised)]">
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--faint)]">
                <th className="px-3 py-2 font-medium">Имя</th>
                <th className="px-3 py-2 font-medium">Рабочая область</th>
                <th className="px-3 py-2 font-medium">Вид</th>
                <th className="px-3 py-2 font-medium">Формат</th>
                <th className="px-3 py-2 font-medium">Включено</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--faint)]">
                    Хранилища не найдены
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr
                  key={`${s.workspace}:${s.name}`}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]"
                  onClick={() => setDetail(s)}
                >
                  <td className="px-3 py-1.5 font-mono text-[var(--text)]">{s.name}</td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{s.workspace}</td>
                  <td className="px-3 py-1.5">
                    <span className="badge kind">{STORE_KIND_LABEL[s.storeType] ?? s.storeType}</span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{s.type ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    <span className={`badge ${s.enabled ? 'pk' : 'kind'}`}>{s.enabled ? 'да' : 'нет'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? 'Хранилище'} width={560}>
        {detail && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Имя" value={detail.name} mono />
              <Info label="Рабочая область" value={detail.workspace} mono />
              <Info label="Вид" value={STORE_KIND_LABEL[detail.storeType] ?? detail.storeType} mono />
              <Info label="Формат" value={detail.type ?? '—'} mono />
              <Info label="Включено" value={detail.enabled ? 'да' : 'нет'} mono />
              <Info label="Дата создания" value={detail.dateCreated ?? '—'} mono />
              <Info label="Дата изменения" value={detail.dateModified ?? '—'} mono />
            </div>
            {detail.description && (
              <div>
                <div className="mb-1 text-[11px] text-[var(--faint)]">Описание</div>
                <div className="text-[12.5px] text-[var(--text)]">{detail.description}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
