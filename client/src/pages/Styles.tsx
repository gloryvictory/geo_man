import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, FileDown, Download, Archive } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Loader, Modal, Input, Button, Info, Select, Tabs } from '../components/ui';
import { exportToExcel, exportToCsv, downloadText, downloadBlob } from '../lib/export';
import type { GeoStyleDetail } from '../types';

function qualifiedName(s: { name: string; workspace: string | null }): string {
  return s.workspace ? `${s.workspace}:${s.name}` : s.name;
}

export default function Styles() {
  const { activeConnId, connected, styles, loadingStyles, fetchStyles } = useStore();
  const [tab, setTab] = useState<'info' | 'legend'>('info');
  const [q, setQ] = useState('');
  const [wsFilter, setWsFilter] = useState('');
  const [lq, setLq] = useState('');
  const [detail, setDetail] = useState<GeoStyleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; name: string } | null>(null);

  const workspaceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of styles) if (s.workspace) set.add(s.workspace);
    return [
      { value: '', label: 'Все' },
      { value: '__global__', label: 'Глобальные' },
      ...Array.from(set).sort().map((w) => ({ value: w, label: w })),
    ];
  }, [styles]);

  const filtered = useMemo(() => {
    let list = styles;
    if (wsFilter === '__global__') list = list.filter((s) => !s.workspace);
    else if (wsFilter) list = list.filter((s) => s.workspace === wsFilter);
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (st) =>
          st.name.toLowerCase().includes(s) ||
          (st.workspace ?? '').toLowerCase().includes(s) ||
          st.format.toLowerCase().includes(s)
      );
    }
    return list;
  }, [styles, q, wsFilter]);

  const filteredLegend = useMemo(() => {
    const s = lq.trim().toLowerCase();
    if (!s) return styles;
    return styles.filter((st) => st.name.toLowerCase().includes(s) || (st.workspace ?? '').toLowerCase().includes(s));
  }, [styles, lq]);

  useEffect(() => {
    function close() {
      setMenu(null);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('wheel', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('wheel', close);
    };
  }, []);

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

  async function downloadAll() {
    if (!activeConnId) return;
    try {
      const res = await fetch(api.stylesExportUrl(activeConnId), { credentials: 'include' });
      if (!res.ok) throw new Error('Ошибка скачивания');
      const blob = await res.blob();
      downloadBlob(blob, 'geo_man_styles.zip');
      toast.success('Все стили скачаны');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка скачивания');
    }
  }

  async function downloadLegend() {
    if (!activeConnId || !detail) return;
    try {
      const res = await fetch(api.stylesLegendUrl(activeConnId, qualifiedName(detail)), { credentials: 'include' });
      if (!res.ok) throw new Error('Ошибка скачивания');
      const blob = await res.blob();
      downloadBlob(blob, `${detail.name}_legend.png`);
      toast.success('Легенда скачана');
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
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as 'info' | 'legend')}
        items={[
          { value: 'info', label: 'Информация' },
          { value: 'legend', label: 'С легендой' },
        ]}
      />

      {tab === 'info' ? (
        <div className="flex min-h-0 flex-1 flex-col pt-3">
          <div className="mb-3 flex items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск стилей…" className="max-w-[320px]" />
            <Select value={wsFilter} onChange={(v) => setWsFilter(v ?? '')} options={workspaceOptions} width={180} />
            <Button variant="subtle" onClick={() => fetchStyles()}>
              <RefreshCw size={13} />
              Обновить
            </Button>
            <Button variant="light" onClick={downloadAll}>
              <Archive size={14} />
              Скачать все стили
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
                      key={qualifiedName(s)}
                      className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]"
                      onClick={() => openDetail(qualifiedName(s))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenu({ x: e.clientX, y: e.clientY, name: qualifiedName(s) });
                      }}
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
                            downloadStyle(qualifiedName(s));
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
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col pt-3">
          <div className="mb-3 flex items-center gap-2">
            <Input value={lq} onChange={(e) => setLq(e.target.value)} placeholder="Поиск стиля…" className="max-w-[320px]" />
            <Button variant="subtle" onClick={() => fetchStyles()}>
              <RefreshCw size={13} />
              Обновить
            </Button>
            <div className="flex-1" />
            <span className="text-[12px] text-[var(--faint)]">{filteredLegend.length} из {styles.length}</span>
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
                    <th className="px-3 py-2 font-medium">Легенда</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLegend.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-[var(--faint)]">
                        Стили не найдены
                      </td>
                    </tr>
                  )}
                  {filteredLegend.map((s) => (
                    <tr key={qualifiedName(s)} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                      <td className="px-3 py-1.5 font-mono text-[var(--text)]">{qualifiedName(s)}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex h-8 items-center">
                          <img
                            src={api.stylesLegendUrl(activeConnId!, qualifiedName(s))}
                            alt=""
                            className="h-6 w-auto"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'info' && menu && (
        <div
          className="fixed z-[100] min-w-[180px] rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12.5px] text-[var(--text)] hover:bg-[var(--surface-hover)]"
            onClick={() => {
              downloadStyle(menu.name);
              setMenu(null);
            }}
          >
            <Download size={13} className="text-[var(--muted)]" />
            Скачать
          </button>
        </div>
      )}

      {tab === 'info' && (
        <Modal open={!!detail || detailLoading} onClose={() => setDetail(null)} title={detail?.name ?? 'Стиль'} width={1050}>
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

              <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">SLD</span>
                    <Button variant="light" onClick={() => downloadStyle(qualifiedName(detail))}>
                      <Download size={14} />
                      Скачать
                    </Button>
                  </div>
                  <pre className="max-h-[55vh] overflow-auto rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-3 font-mono text-[11.5px] leading-relaxed text-[var(--text)]">
                    {detail.sld || '(пусто)'}
                  </pre>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Легенда</span>
                    <Button variant="light" onClick={downloadLegend}>
                      <Download size={14} />
                      Экспорт
                    </Button>
                  </div>
                  <div className="flex max-h-[55vh] flex-1 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-3">
                    <img
                      src={api.stylesLegendUrl(activeConnId!, qualifiedName(detail))}
                      alt="Легенда"
                      className="max-h-[50vh] max-w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
