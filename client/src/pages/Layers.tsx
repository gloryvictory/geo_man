import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, FileDown } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Loader, Modal, Input, Button, Info, Select, Tabs } from '../components/ui';
import { exportToExcel, exportToCsv } from '../lib/export';
import type { LayerDetail, LayerAnalyticsRow } from '../types';

const ANALYTICS_COLS: { key: keyof LayerAnalyticsRow; label: string }[] = [
  { key: 'l_name', label: 'Слой' },
  { key: 'l_title', label: 'Заголовок' },
  { key: 'l_projection', label: 'Проекция' },
  { key: 'w_name', label: 'Рабочая область' },
  { key: 'w_name_full', label: 'Полное имя' },
  { key: 's_name', label: 'Хранилище' },
  { key: 's_host', label: 'Хост' },
  { key: 's_port', label: 'Порт' },
  { key: 's_database', label: 'БД' },
  { key: 's_schema', label: 'Схема' },
  { key: 's_native_name', label: 'Нативное имя' },
  { key: 's_user', label: 'Пользователь' },
  { key: 's_dbtype', label: 'Тип БД' },
  { key: 's_native_srs', label: 'Нативный SRS' },
];

export default function Layers() {
  const { activeConnId, connected, layers, loadingLayers, fetchLayers } = useStore();
  const [tab, setTab] = useState<'info' | 'analytics'>('info');
  const [q, setQ] = useState('');
  const [wsFilter, setWsFilter] = useState('');
  const [aq, setAq] = useState('');
  const [awsFilter, setAwsFilter] = useState('');
  const [analytics, setAnalytics] = useState<LayerAnalyticsRow[] | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [detail, setDetail] = useState<LayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const workspaceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of layers) if (l.workspace) set.add(l.workspace);
    return [
      { value: '', label: 'Все' },
      ...Array.from(set).sort().map((w) => ({ value: w, label: w })),
    ];
  }, [layers]);

  const filtered = useMemo(() => {
    let list = layers;
    if (wsFilter) list = list.filter((l) => l.workspace === wsFilter);
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(s) ||
          l.workspace.toLowerCase().includes(s) ||
          (l.type ?? '').toLowerCase().includes(s) ||
          (l.defaultStyle ?? '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [layers, q, wsFilter]);

  const analyticsWorkspaceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of analytics ?? []) if (r.w_name) set.add(r.w_name);
    return [
      { value: '', label: 'Все' },
      ...Array.from(set).sort().map((w) => ({ value: w, label: w })),
    ];
  }, [analytics]);

  const filteredAnalytics = useMemo(() => {
    let list = analytics ?? [];
    if (awsFilter) list = list.filter((r) => r.w_name === awsFilter);
    const s = aq.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (r) =>
        r.l_name.toLowerCase().includes(s) ||
        r.l_title.toLowerCase().includes(s) ||
        r.s_name.toLowerCase().includes(s) ||
        r.s_host.toLowerCase().includes(s) ||
        r.s_database.toLowerCase().includes(s)
    );
  }, [analytics, aq, awsFilter]);

  async function loadAnalytics(force = false) {
    if (!activeConnId) return;
    if (!force && (analytics !== null || analyticsLoading)) return;
    setAnalyticsLoading(true);
    try {
      setAnalytics(await api.layersAnalytics(activeConnId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки аналитики');
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'analytics') loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
    const header = ['Слой', 'Рабочая область', 'Тип', 'GWC', 'Стиль по умолчанию', 'Ресурс', 'Стилей'];
    const rows = filtered.map((l) => [l.name, l.workspace, l.type ?? '', l.gwc ? 'да' : 'нет', l.defaultStyle ?? '', l.resourceName ?? '', String(l.availableStyles.length)]);
    if (format === 'xlsx') exportToExcel('geo_man_layers', header, rows);
    else exportToCsv('geo_man_layers', header, rows);
  }

  function doExportAnalytics(format: 'xlsx' | 'csv') {
    const header = ANALYTICS_COLS.map((c) => c.label);
    const rows = filteredAnalytics.map((r) => ANALYTICS_COLS.map((c) => r[c.key]));
    if (format === 'xlsx') exportToExcel('geo_man_layers_analytics', header, rows);
    else exportToCsv('geo_man_layers_analytics', header, rows);
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
        onChange={(v) => setTab(v as 'info' | 'analytics')}
        items={[
          { value: 'info', label: 'Информация' },
          { value: 'analytics', label: 'Аналитика' },
        ]}
      />

      {tab === 'info' ? (
        <div className="flex min-h-0 flex-1 flex-col pt-3">
          <div className="mb-3 flex items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск слоёв…" className="max-w-[320px]" />
            <Select value={wsFilter} onChange={(v) => setWsFilter(v ?? '')} options={workspaceOptions} width={180} />
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
                    <th className="px-3 py-2 font-medium">GWC</th>
                    <th className="px-3 py-2 font-medium">Стиль по умолчанию</th>
                    <th className="px-3 py-2 font-medium">Ресурс</th>
                    <th className="px-3 py-2 font-medium">Стилей</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-[var(--faint)]">
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
                      <td className="px-3 py-1.5">
                        <span className={`badge ${l.gwc ? 'pk' : 'kind'}`}>{l.gwc ? 'да' : 'нет'}</span>
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
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col pt-3">
          <div className="mb-3 flex items-center gap-2">
            <Input value={aq} onChange={(e) => setAq(e.target.value)} placeholder="Поиск по слою/хранилищу/хосту…" className="max-w-[320px]" />
            <Select value={awsFilter} onChange={(v) => setAwsFilter(v ?? '')} options={analyticsWorkspaceOptions} width={180} />
            <Button variant="subtle" onClick={() => loadAnalytics(true)}>
              <RefreshCw size={13} />
              Обновить
            </Button>
            <div className="flex-1" />
            <span className="text-[12px] text-[var(--faint)]">{filteredAnalytics.length} из {(analytics ?? []).length}</span>
            <Button variant="subtle" onClick={() => doExportAnalytics('xlsx')}>
              <FileDown size={13} />
              Excel
            </Button>
            <Button variant="subtle" onClick={() => doExportAnalytics('csv')}>
              <FileDown size={13} />
              CSV
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--border)]">
            {analyticsLoading || analytics === null ? (
              <div className="grid h-full place-items-center">
                <Loader size={24} />
              </div>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 bg-[var(--bg-raised)]">
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--faint)]">
                    {ANALYTICS_COLS.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalytics.length === 0 && (
                    <tr>
                      <td colSpan={ANALYTICS_COLS.length} className="px-3 py-6 text-center text-[var(--faint)]">
                        Нет данных
                      </td>
                    </tr>
                  )}
                  {filteredAnalytics.map((r, i) => (
                    <tr key={`${r.w_name_full}-${i}`} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                      {ANALYTICS_COLS.map((c) => (
                        <td key={c.key} className="whitespace-nowrap px-3 py-1.5 font-mono text-[var(--muted)]">
                          {r[c.key] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'info' && (
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
      )}
    </div>
  );
}
