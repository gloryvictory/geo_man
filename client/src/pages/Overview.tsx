import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import { api } from '../api';
import { Loader, Tabs, Input, Button } from '../components/ui';
import { exportToExcel, exportToCsv } from '../lib/export';
import { Layers, Palette, Box, ChevronRight, Database, Boxes, RefreshCw, FileDown } from 'lucide-react';
import type { ManifestEntry } from '../types';

function StatCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4 ${
        onClick ? 'cursor-pointer transition-colors hover:border-[var(--accent-dim)] hover:bg-[var(--surface-hover)]' : ''
      }`}
      onClick={onClick}
    >
      <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--accent-bg)] text-[var(--accent)]">{icon}</span>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-[var(--faint)]">{label}</div>
        <div className="font-mono text-[18px] font-semibold text-[var(--text)]">{value}</div>
      </div>
      {onClick && <ChevronRight size={16} className="ml-auto shrink-0 text-[var(--faint)]" />}
    </div>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const { activeConnId, connected, connecting, info, layers, stores, layergroups, loadingInfo } = useStore();
  const [tab, setTab] = useState<'info' | 'config'>('info');
  const [q, setQ] = useState('');
  const [manifest, setManifest] = useState<ManifestEntry[] | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of layers) {
      const t = l.type || '—';
      m.set(t, (m.get(t) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [layers]);

  const maxType = typeCounts.length ? typeCounts[0][1] : 1;

  const filteredManifest = useMemo(() => {
    const list = manifest ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (m) => m.name.toLowerCase().includes(s) || m.title.toLowerCase().includes(s) || m.version.toLowerCase().includes(s)
    );
  }, [manifest, q]);

  async function loadManifest(force = false) {
    if (!activeConnId) return;
    if (!force && (manifest !== null || manifestLoading)) return;
    setManifestLoading(true);
    try {
      setManifest(await api.manifest(activeConnId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки манифеста');
    } finally {
      setManifestLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'config') loadManifest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function doExport(format: 'xlsx' | 'csv') {
    const header = ['Имя', 'Название', 'Версия'];
    const rows = filteredManifest.map((m) => [m.name, m.title, m.version]);
    if (format === 'xlsx') exportToExcel('geo_man_manifest', header, rows);
    else exportToCsv('geo_man_manifest', header, rows);
  }

  if (!activeConnId) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-[var(--faint)]">
        Добавьте подключение GeoServer, чтобы начать работу.
      </div>
    );
  }

  if (connecting || loadingInfo) {
    return (
      <div className="grid h-full place-items-center">
        <Loader size={28} />
      </div>
    );
  }

  if (!connected || !info) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-[var(--faint)]">
        Нет подключения — нажмите «Подключить» в шапке.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-5">
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as 'info' | 'config')}
        items={[
          { value: 'info', label: 'Информация' },
          { value: 'config', label: 'Конфигурация' },
        ]}
      />

      {tab === 'info' ? (
        <div className="min-h-0 flex-1 overflow-auto pt-4">
          <div className="mb-5 flex items-baseline gap-4">
            <h1 className="text-[20px] font-semibold">GeoServer</h1>
            <span className="font-mono text-[14px] text-[var(--accent)]">v{info.version}</span>
            {info.buildTimestamp && <span className="text-[12px] text-[var(--muted)]">сборка {info.buildTimestamp}</span>}
          </div>

          <div className="mb-5 grid grid-cols-5 gap-3">
            <StatCard
              icon={<Box size={18} />}
              label="Рабочие области"
              value={info.workspaceCount}
              onClick={() => navigate('/workspaces')}
            />
            <StatCard
              icon={<Database size={18} />}
              label="Хранилища"
              value={stores.length}
              onClick={() => navigate('/stores')}
            />
            <StatCard
              icon={<Boxes size={18} />}
              label="Группы слоев"
              value={layergroups.length}
              onClick={() => navigate('/layergroups')}
            />
            <StatCard
              icon={<Layers size={18} />}
              label="Слои"
              value={info.layerCount}
              onClick={() => navigate('/layers')}
            />
            <StatCard
              icon={<Palette size={18} />}
              label="Стили"
              value={info.styleCount}
              onClick={() => navigate('/styles')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--faint)]">Модули</h2>
              <table className="w-full text-[12.5px]">
                <tbody>
                  {info.modules.map((m) => (
                    <tr key={m.name} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-1.5 pr-2 text-[var(--text)]">{m.name}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--muted)]">{m.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {info.gitRevision && (
                <div className="mt-3 break-all text-[11px] text-[var(--faint)]">
                  <span className="text-[var(--muted)]">Git:</span>{' '}
                  <span className="font-mono">{info.gitRevision}</span>
                </div>
              )}
            </div>

            <div className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--faint)]">Слои по типу</h2>
              {typeCounts.length === 0 && <span className="text-[12px] text-[var(--faint)]">Нет данных</span>}
              <div className="flex flex-col gap-2">
                {typeCounts.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 font-mono text-[12px] text-[var(--text)]">{type}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-[var(--surface-hover)]">
                      <div
                        className="h-full rounded bg-[var(--accent)]"
                        style={{ width: `${(count / maxType) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right font-mono text-[12px] text-[var(--muted)]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени/названию/версии…" className="max-w-[320px]" />
            <Button variant="subtle" onClick={() => loadManifest(true)}>
              <RefreshCw size={13} />
              Обновить
            </Button>
            <div className="flex-1" />
            <span className="text-[12px] text-[var(--faint)]">{filteredManifest.length} из {(manifest ?? []).length}</span>
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
            {manifestLoading || manifest === null ? (
              <div className="grid h-full place-items-center">
                <Loader size={24} />
              </div>
            ) : (
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="sticky top-0 bg-[var(--bg-raised)]">
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--faint)]">
                    <th className="px-3 py-2 font-medium">Имя</th>
                    <th className="px-3 py-2 font-medium">Название</th>
                    <th className="px-3 py-2 font-medium">Версия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredManifest.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-[var(--faint)]">
                        Нет данных
                      </td>
                    </tr>
                  )}
                  {filteredManifest.map((m) => (
                    <tr key={m.name} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                      <td className="px-3 py-1.5 font-mono text-[var(--text)]">{m.name}</td>
                      <td className="px-3 py-1.5 text-[var(--muted)]">{m.title || '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-[var(--muted)]">{m.version || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
