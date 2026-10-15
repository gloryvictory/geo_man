import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, FileDown } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Loader, Modal, Input, Button, Info } from '../components/ui';
import { exportToExcel, exportToCsv } from '../lib/export';
import type { LayerDetail } from '../types';

export default function Layers() {
  const { activeConnId, connected, layers, loadingLayers, fetchLayers } = useStore();
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<LayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return layers;
    return layers.filter(
      (l) =>
        l.name.toLowerCase().includes(s) ||
        l.workspace.toLowerCase().includes(s) ||
        (l.type ?? '').toLowerCase().includes(s) ||
        (l.defaultStyle ?? '').toLowerCase().includes(s)
    );
  }, [layers, q]);

  async function openDetail(name: string) {
    if (!activeConnId) return;
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await api.layerDetail(activeConnId, name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setDetailLoading(false);
    }
  }

  function doExport(format: 'xlsx' | 'csv') {
    const header = ['Слой', 'Рабочая область', 'Тип', 'Стиль по умолчанию', 'Ресурс', 'Стилей'];
    const rows = filtered.map((l) => [l.name, l.workspace, l.type ?? '', l.defaultStyle ?? '', l.resourceName ?? '', String(l.availableStyles.length)]);
    if (format === 'xlsx') exportToExcel('geo_man_layers', header, rows);
    else exportToCsv('geo_man_layers', header, rows);
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
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск слоёв…" className="max-w-[320px]" />
        <Button variant="subtle" onClick={() => fetchLayers()}>
          <RefreshCw size={13} />
          Обновить
        </Button>
        <div className="flex-1" />
        <span className="text-[12px] text-[var(--faint)]">{filtered.length} из {layers.length}</span>
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
        {loadingLayers ? (
          <div className="grid h-full place-items-center">
            <Loader size={24} />
          </div>
        ) : (
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--bg-raised)]">
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--faint)]">
                <th className="px-3 py-2 font-medium">Слой</th>
                <th className="px-3 py-2 font-medium">Рабочая область</th>
                <th className="px-3 py-2 font-medium">Тип</th>
                <th className="px-3 py-2 font-medium">Стиль по умолчанию</th>
                <th className="px-3 py-2 font-medium">Ресурс</th>
                <th className="px-3 py-2 font-medium">Стилей</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--faint)]">
                    Слои не найдены
                  </td>
                </tr>
              )}
              {filtered.map((l) => (
                <tr
                  key={l.name}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]"
                  onClick={() => openDetail(l.name)}
                >
                  <td className="px-3 py-1.5 font-mono text-[var(--text)]">{l.name}</td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{l.workspace}</td>
                  <td className="px-3 py-1.5">
                    {l.type && <span className="badge kind">{l.type}</span>}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{l.defaultStyle ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{l.resourceName ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-[var(--muted)]">{l.availableStyles.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detail || detailLoading} onClose={() => setDetail(null)} title={detail?.name ?? 'Слой'} width={560}>
        {detailLoading ? (
          <div className="grid place-items-center py-8">
            <Loader size={24} />
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Рабочая область" value={detail.workspace} mono />
              <Info label="Тип" value={detail.type ?? '—'} mono />
              <Info label="Стиль по умолчанию" value={detail.defaultStyle ?? '—'} mono />
              <Info label="Ресурс" value={detail.resourceClass ?? '—'} mono />
              <Info label="Полное имя ресурса" value={detail.resourceName ?? '—'} mono />
              <Info label="Путь" value={detail.href || '—'} mono />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-[var(--faint)]">Доступные стили</div>
              <div className="flex flex-wrap gap-1.5">
                {detail.availableStyles.length === 0 && <span className="text-[12px] text-[var(--faint)]">Нет</span>}
                {detail.availableStyles.map((s) => (
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
