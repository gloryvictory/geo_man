import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, FileDown } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Loader, Modal, Input, Button, Info } from '../components/ui';
import { exportToExcel, exportToCsv } from '../lib/export';
import type { WorkspaceDetail } from '../types';

export default function Workspaces() {
  const { activeConnId, connected, workspaces, loadingWorkspaces, fetchWorkspaces } = useStore();
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(s));
  }, [workspaces, q]);

  async function openDetail(name: string) {
    if (!activeConnId) return;
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await api.workspaceDetail(activeConnId, name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setDetailLoading(false);
    }
  }

  function doExport(format: 'xlsx' | 'csv') {
    const header = ['Имя', 'Изолированная', 'Дата создания', 'Дата изменения'];
    const rows = filtered.map((w) => [w.name, w.isolated ? 'да' : 'нет', w.dateCreated ?? '', w.dateModified ?? '']);
    if (format === 'xlsx') exportToExcel('geo_man_workspaces', header, rows);
    else exportToCsv('geo_man_workspaces', header, rows);
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
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск рабочих областей…" className="max-w-[320px]" />
        <Button variant="subtle" onClick={() => fetchWorkspaces()}>
          <RefreshCw size={13} />
          Обновить
        </Button>
        <div className="flex-1" />
        <span className="text-[12px] text-[var(--faint)]">{filtered.length} из {workspaces.length}</span>
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
        {loadingWorkspaces ? (
          <div className="grid h-full place-items-center">
            <Loader size={24} />
          </div>
        ) : (
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--bg-raised)]">
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--faint)]">
                <th className="px-3 py-2 font-medium">Имя</th>
                <th className="px-3 py-2 font-medium">Изолированная</th>
                <th className="px-3 py-2 font-medium">Дата создания</th>
                <th className="px-3 py-2 font-medium">Дата изменения</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[var(--faint)]">
                    Рабочие области не найдены
                  </td>
                </tr>
              )}
              {filtered.map((w) => (
                <tr
                  key={w.name}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]"
                  onClick={() => openDetail(w.name)}
                >
                  <td className="px-3 py-1.5 font-mono text-[var(--text)]">{w.name}</td>
                  <td className="px-3 py-1.5">
                    <span className={`badge ${w.isolated ? 'pk' : 'kind'}`}>{w.isolated ? 'да' : 'нет'}</span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{w.dateCreated ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{w.dateModified ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detail || detailLoading} onClose={() => setDetail(null)} title={detail?.name ?? 'Рабочая область'} width={560}>
        {detailLoading ? (
          <div className="grid place-items-center py-8">
            <Loader size={24} />
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Имя" value={detail.name} mono />
              <Info label="Изолированная" value={detail.isolated ? 'да' : 'нет'} mono />
              <Info label="Дата создания" value={detail.dateCreated ?? '—'} mono />
              <Info label="Дата изменения" value={detail.dateModified ?? '—'} mono />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-[var(--faint)]">Хранилища данных</div>
              <div className="flex flex-wrap gap-1.5">
                {detail.dataStores.length === 0 && <span className="text-[12px] text-[var(--faint)]">Нет</span>}
                {detail.dataStores.map((s) => (
                  <span key={s} className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 font-mono text-[11.5px] text-[var(--text)]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
