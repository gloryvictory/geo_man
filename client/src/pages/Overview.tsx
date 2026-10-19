import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Loader } from '../components/ui';
import { Layers, Palette, Box, ChevronRight } from 'lucide-react';

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
  const { activeConnId, connected, connecting, info, layers, loadingInfo } = useStore();

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of layers) {
      const t = l.type || '—';
      m.set(t, (m.get(t) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [layers]);

  const maxType = typeCounts.length ? typeCounts[0][1] : 1;

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
    <div className="h-full overflow-auto p-5">
      <div className="mb-5 flex items-baseline gap-4">
        <h1 className="text-[20px] font-semibold">GeoServer</h1>
        <span className="font-mono text-[14px] text-[var(--accent)]">v{info.version}</span>
        {info.buildTimestamp && <span className="text-[12px] text-[var(--muted)]">сборка {info.buildTimestamp}</span>}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard
          icon={<Box size={18} />}
          label="Рабочие области"
          value={info.workspaceCount}
          onClick={() => navigate('/workspaces')}
        />
        <StatCard icon={<Layers size={18} />} label="Слои" value={info.layerCount} />
        <StatCard icon={<Palette size={18} />} label="Стили" value={info.styleCount} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
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

        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--faint)]">Рабочие области</h2>
          <div className="flex flex-wrap gap-1.5">
            {info.workspaces.length === 0 && <span className="text-[12px] text-[var(--faint)]">Нет рабочих областей</span>}
            {info.workspaces.map((w) => (
              <span key={w} className="rounded bg-[var(--surface-elevated)] px-2 py-1 font-mono text-[12px] text-[var(--text)]">
                {w}
              </span>
            ))}
          </div>
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
  );
}
