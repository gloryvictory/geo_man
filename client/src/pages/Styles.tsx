import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, FileDown, Download } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Loader, Modal, Input, Button, Info } from '../components/ui';
import { exportToExcel, exportToCsv, downloadText } from '../lib/export';
import type { GeoStyleDetail } from '../types';

export default function Styles() {
  const { activeConnId, connected, styles, loadingStyles, fetchStyles } = useStore();
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<GeoStyleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return styles;
    return styles.filter(
      (st) =>
        st.name.toLowerCase().includes(s) ||
        (st.workspace ?? '').toLowerCase().includes(s) ||
        st.format.toLowerCase().includes(s)
    );
  }, [styles, q]);

  async function openDetail(name: string) {
    if (!activeConnId) return;
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await api.styleDetail(activeConnId, name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setDetailLoading(false);
    }
  }

  async function downloadStyle(name: string) {
    if (!activeConnId) return;
    try {
      const d = await api.styleDetail(activeConnId, name);
      downloadText(d.filename || `${name}.sld`, d.sld);
      toast.success('Стиль скачан');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка скачивания');
    }
  }

  function doExport(format: 'xlsx' | 'csv') {
    const header = ['Стиль', 'Рабочая область', 'Формат', 'Версия', 'Файл'];
    const rows = filtered.map((s) => [s.name, s.workspace ?? '', s.format, s.version, s.filename]);
    if (format === 'xlsx') exportToExcel('geo_man_styles', header, rows);
    else exportToCsv('geo_man_styles', header, rows);
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
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск стилей…" className="max-w-[320px]" />
        <Button variant="subtle" onClick={() => fetchStyles()}>
          <RefreshCw size={13} />
          Обновить
        </Button>
        <div className="flex-1" />
        <span className="text-[12px] text-[var(--faint)]">{filtered.length} из {styles.length}</span>
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
        {loadingStyles ? (
          <div className="grid h-full place-items-center">
            <Loader size={24} />
          </div>
        ) : (
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--bg-raised)]">
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--faint)]">
                <th className="px-3 py-2 font-medium">Стиль</th>
                <th className="px-3 py-2 font-medium">Рабочая область</th>
                <th className="px-3 py-2 font-medium">Формат</th>
                <th className="px-3 py-2 font-medium">Версия</th>
                <th className="px-3 py-2 font-medium">Файл</th>
                <th className="px-3 py-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--faint)]">
                    Стили не найдены
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr
                  key={s.name}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]"
                  onClick={() => openDetail(s.name)}
                >
                  <td className="px-3 py-1.5 font-mono text-[var(--text)]">{s.name}</td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{s.workspace ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    <span className="badge kind">{s.format || '—'}</span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{s.version || '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{s.filename || '—'}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Button
                      variant="icon"
                      title="Скачать стиль"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadStyle(s.name);
                      }}
                    >
                      <Download size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detail || detailLoading} onClose={() => setDetail(null)} title={detail?.name ?? 'Стиль'} width={760}>
        {detailLoading ? (
          <div className="grid place-items-center py-8">
            <Loader size={24} />
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-3">
              <Info label="Формат" value={detail.format || '—'} mono />
              <Info label="Версия" value={detail.version || '—'} mono />
              <Info label="Рабочая область" value={detail.workspace ?? '—'} mono />
              <Info label="Файл" value={detail.filename || '—'} mono />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-[var(--faint)]">SLD</div>
              <pre className="max-h-[50vh] overflow-auto rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-3 font-mono text-[11.5px] leading-relaxed text-[var(--text)]">
                {detail.sld || '(пусто)'}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
