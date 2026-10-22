import { useMemo, useState } from 'react';
import { RefreshCw, FileDown } from 'lucide-react';
import { useStore } from '../store';
import { Loader, Modal, Input, Button, Info, Select } from '../components/ui';
import { exportToExcel, exportToCsv } from '../lib/export';
import type { GeoLayerGroup } from '../types';

export default function LayerGroups() {
  const { activeConnId, connected, connecting, layergroups, loadingLayergroups, fetchLayergroups } = useStore();
  const [q, setQ] = useState('');
  const [wsFilter, setWsFilter] = useState('');
  const [detail, setDetail] = useState<GeoLayerGroup | null>(null);

  const workspaceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const g of layergroups) if (g.workspace) set.add(g.workspace);
    return [
      { value: '', label: 'Все' },
      { value: '__global__', label: 'Глобальные' },
      ...Array.from(set).sort().map((w) => ({ value: w, label: w })),
    ];
  }, [layergroups]);

  const filtered = useMemo(() => {
    let list = layergroups;
    if (wsFilter === '__global__') list = list.filter((g) => !g.workspace);
    else if (wsFilter) list = list.filter((g) => g.workspace === wsFilter);
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(s) ||
          (g.workspace ?? '').toLowerCase().includes(s) ||
          (g.mode ?? '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [layergroups, q, wsFilter]);

  function doExport(format: 'xlsx' | 'csv') {
    const header = ['Имя', 'Рабочая область', 'Режим', 'Слоёв'];
    const rows = filtered.map((g) => [g.name, g.workspace ?? '', g.mode ?? '', String(g.layerCount)]);
    if (format === 'xlsx') exportToExcel('geo_man_layergroups', header, rows);
    else exportToCsv('geo_man_layergroups', header, rows);
  }

  if (!activeConnId) {
    return <div className="grid h-full place-items-center text-[13px] text-[var(--faint)]">Добавьте подключение GeoServer.</div>;
  }
  if (connecting) {
    return (
      <div className="grid h-full place-items-center">
        <Loader size={28} />
      </div>
    );
  }
  if (!connected) {
    return <div className="grid h-full place-items-center text-[13px] text-[var(--faint)]">Нет подключения — нажмите «Подключить».</div>;
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск групп слоёв…" className="max-w-[320px]" />
        <Select value={wsFilter} onChange={(v) => setWsFilter(v ?? '')} options={workspaceOptions} width={180} />
        <Button variant="subtle" onClick={() => fetchLayergroups()}>
          <RefreshCw size={13} />
          Обновить
        </Button>
        <div className="flex-1" />
        <span className="text-[12px] text-[var(--faint)]">{filtered.length} из {layergroups.length}</span>
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
        {loadingLayergroups ? (
          <div className="grid h-full place-items-center">
            <Loader size={24} />
          </div>
        ) : (
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--bg-raised)]">
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--faint)]">
                <th className="px-3 py-2 font-medium">Имя</th>
                <th className="px-3 py-2 font-medium">Рабочая область</th>
                <th className="px-3 py-2 font-medium">Режим</th>
                <th className="px-3 py-2 font-medium">Слоёв</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[var(--faint)]">
                    Группы слоёв не найдены
                  </td>
                </tr>
              )}
              {filtered.map((g) => (
                <tr
                  key={g.workspace ? `${g.workspace}:${g.name}` : g.name}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]"
                  onClick={() => setDetail(g)}
                >
                  <td className="px-3 py-1.5 font-mono text-[var(--text)]">{g.name}</td>
                  <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{g.workspace ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    <span className="badge kind">{g.mode ?? '—'}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[var(--muted)]">{g.layerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? 'Группа слоёв'} width={560}>
        {detail && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Имя" value={detail.name} mono />
              <Info label="Рабочая область" value={detail.workspace ?? '—'} mono />
              <Info label="Режим" value={detail.mode ?? '—'} mono />
              <Info label="Слоёв" value={String(detail.layerCount)} mono />
            </div>
            {detail.title && (
              <div>
                <div className="mb-1 text-[11px] text-[var(--faint)]">Заголовок</div>
                <div className="text-[12.5px] text-[var(--text)]">{detail.title}</div>
              </div>
            )}
            <div>
              <div className="mb-1.5 text-[11px] text-[var(--faint)]">Слои</div>
              <div className="flex flex-wrap gap-1.5">
                {detail.layers.length === 0 && <span className="text-[12px] text-[var(--faint)]">Нет</span>}
                {detail.layers.map((l) => (
                  <span key={l} className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 font-mono text-[11.5px] text-[var(--text)]">
                    {l}
                  </span>
                ))}
              </div>
            </div>
            {detail.styles.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] text-[var(--faint)]">Стили</div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.styles.map((s) => (
                    <span key={s} className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 font-mono text-[11.5px] text-[var(--text)]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
