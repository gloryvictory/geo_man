import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Power, Moon, Sun, User, ChevronDown, LogOut, ShieldCheck, Layers, Palette, Info } from 'lucide-react';
import { useStore } from '../store';
import { getTheme, applyTheme, type Theme } from '../lib/theme';
import { Button, Select, Modal } from './ui';
import ConnectionModal from './ConnectionModal';
import AdminPanel from './AdminPanel';
import { useAuth } from '../store/authStore';

const ABOUT = {
  version: '1.0.0',
  author: 'Замараев Вячеслав Викторович',
  email: 'zamaraev@gmail.com',
  release: '15.10.2026',
  repo: 'https://github.com/gloryvictory/geo_man',
};

export default function Topbar() {
  const store = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [connOpen, setConnOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme());
  const auth = useAuth();
  const [userOpen, setUserOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  function toggleTheme() {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }

  // автоподключение к последней конфигурации при открытии приложения
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useStore.getState().loadConnections();
      const id = localStorage.getItem('geoman-last-conn');
      if (cancelled || !id) return;
      const exists = useStore.getState().connections.some((c) => c.id === id);
      if (!exists) return;
      await useStore.getState().connect(id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = store.connections.map((c) => ({
    value: c.id,
    label: `${c.name} — ${c.host}:${c.port}`,
  }));

  async function onSelectConn(id: string | null) {
    if (!id) return;
    store.setActiveConn(id);
    await store.connect(id);
  }

  const dot = store.connecting ? 'processing' : store.connected ? 'green' : 'gray';

  const navItem = (path: string, icon: React.ReactNode, label: string) => (
    <Button variant={location.pathname === path ? 'light' : 'subtle'} onClick={() => navigate(path)}>
      {icon}
      {label}
    </Button>
  );

  return (
    <header className="flex h-[46px] items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-raised)] px-3">
      <div className="group relative flex cursor-pointer items-center gap-2 text-[13px] font-semibold" onClick={() => setAboutOpen(true)}>
        <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dim)] font-mono text-xs font-bold text-[var(--accent-fg)]">
          ▣
        </span>
        <span>geo_man</span>
        <div className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden w-[280px] rounded-md border border-[var(--border)] bg-[var(--bg-raised)] p-2.5 shadow-xl group-hover:block">
          <div className="text-[13px] font-semibold">geo_man</div>
          <div className="mt-0.5 font-mono text-[11.5px] text-[var(--muted)]">v{ABOUT.version}</div>
          <div className="text-[11.5px] text-[var(--muted)]">Автор: {ABOUT.author}</div>
          <div className="text-[11.5px] text-[var(--muted)]">Email: {ABOUT.email}</div>
          <div className="text-[11.5px] text-[var(--muted)]">Релиз: {ABOUT.release}</div>
          <div className="break-all text-[11.5px] text-[var(--accent)]">{ABOUT.repo}</div>
        </div>
      </div>

      <div className="h-[22px] w-px bg-[var(--border)]" />

      <Select
        width={420}
        value={store.activeConnId}
        onChange={onSelectConn}
        options={options}
        placeholder="Выберите подключение"
        searchable
        dot={dot}
      />
      <Button variant="icon" title="Добавить подключение" onClick={() => setConnOpen(true)}>
        <Plus size={15} />
      </Button>
      {store.activeConnId &&
        (store.connected ? (
          <Button variant="icon" title="Отключиться" onClick={() => store.disconnect()}>
            <Power size={15} />
          </Button>
        ) : (
          <Button variant="light" onClick={() => onSelectConn(store.activeConnId!)}>
            Подключить
          </Button>
        ))}

      <div className="flex-1" />

      <nav className="flex items-center gap-1">
        {navItem('/', <Info size={14} />, 'Обзор')}
        {navItem('/layers', <Layers size={14} />, 'Слои')}
        {navItem('/styles', <Palette size={14} />, 'Стили')}
      </nav>

      <Button
        variant="icon"
        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </Button>

      <div className="relative">
        <Button variant="subtle" onClick={() => setUserOpen((o) => !o)} title={auth.user?.fio}>
          <User size={14} />
          <span className="max-w-[140px] truncate">{auth.user?.login}</span>
          <ChevronDown size={12} />
        </Button>
        {userOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setUserOpen(false)} />
            <div className="absolute right-0 top-full z-30 mt-1 w-[230px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-raised)] shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{auth.user?.fio}</div>
                  <div className="truncate font-mono text-[11px] text-[var(--muted)]">{auth.user?.login}</div>
                </div>
                {auth.user?.role === 'admin' && (
                  <span className="ml-2 shrink-0 rounded bg-[var(--accent-bg-hover)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                    админ
                  </span>
                )}
              </div>
              {auth.user?.role === 'admin' && (
                <div
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--bg-panel)]"
                  onClick={() => {
                    setUserOpen(false);
                    setAdminOpen(true);
                  }}
                >
                  <ShieldCheck size={14} />
                  Админка
                </div>
              )}
              <div
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--bg-panel)]"
                onClick={() => {
                  setUserOpen(false);
                  auth.logout();
                }}
              >
                <LogOut size={14} />
                Выйти
              </div>
            </div>
          </>
        )}
      </div>

      <ConnectionModal open={connOpen} onClose={() => setConnOpen(false)} />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />

      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="О приложении" width={460}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-[40px] w-[40px] place-items-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dim)] font-mono text-lg font-bold text-[var(--accent-fg)]">
              ▣
            </span>
            <div>
              <div className="text-[16px] font-semibold">geo_man</div>
              <div className="text-[12px] text-[var(--muted)]">менеджер GeoServer</div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Версия</span>
              <span className="font-mono">{ABOUT.version}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="shrink-0 text-[var(--muted)]">Автор</span>
              <span className="text-right">{ABOUT.author}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="shrink-0 text-[var(--muted)]">Email</span>
              <a href={`mailto:${ABOUT.email}`} className="font-mono text-[var(--accent)] hover:underline">
                {ABOUT.email}
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Дата релиза</span>
              <span className="font-mono">{ABOUT.release}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="shrink-0 text-[var(--muted)]">Проект</span>
              <a
                href={ABOUT.repo}
                target="_blank"
                rel="noreferrer"
                className="break-all text-right font-mono text-[var(--accent)] hover:underline"
              >
                {ABOUT.repo}
              </a>
            </div>
          </div>
        </div>
      </Modal>
    </header>
  );
}
