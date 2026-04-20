import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import BrandLogo from './BrandLogo';
import CookieNotice from './CookieNotice';
import Toast from './Toast';
import NotificationDropdown from './NotificationDropdown';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import PlanLimitModal from './PlanLimitModal';

// ── Icons ─────────────────────────────────────────────────────────────
const Ico = ({ d, size = 16, stroke = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const Icons = {
  grid:     <Ico d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  activity: <Ico d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  bell:     <Ico d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 21a2 2 0 0 0 4 0" />,
  user:     <Ico d="M5 20c0-3 3-5 7-5s7 2 7 5M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  brain:    <Ico d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 1 5 3 3 0 0 0 3 3c1.5 0 3-1 3-3V4c0-2-1.5-3-3-3zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-1 5 3 3 0 0 1-3 3" />,
  book:     <Ico d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM8 7h8M8 11h8" />,
  bolt:     <Ico d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  personas: <Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  plug:     <Ico d="M9 2v6M15 2v6M6 8h12l-1 6a5 5 0 0 1-10 0zM12 18v4" />,
  key:      <Ico d="M14 9a5 5 0 1 0-3.9 4.9L13 18l2-2 2 2 3-3-5-5a5 5 0 0 0 0-1z" />,
  shield:   <Ico d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  terminal: <Ico d="M4 5h16v14H4zM7 9l3 3-3 3M13 15h5" />,
  eye:      <Ico d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  settings: <Ico d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12a7 7 0 0 0-.1-1.2l2.1-1.6-2-3.4-2.5 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2L5 5.8l-2 3.4 2.1 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2L3 14.8l2 3.4 2.5-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.5 1 2-3.4-2.1-1.6c.1-.4.1-.8.1-1.2z" />,
  search:   <Ico d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />,
  store:    <Ico d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
  list:     <Ico d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  docs:     <Ico d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />,
  api:      <Ico d="M4 17l6-6-6-6M12 19h8" />,
  team:     <Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  enterprise:<Ico d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  users:    <Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  beta:     <Ico d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  ticket:   <Ico d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z" />,
  menu:     <Ico d="M3 12h18M3 6h18M3 18h18" />,
  x:        <Ico d="M6 6l12 12M18 6L6 18" />,
  sun:      <Ico d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />,
  moon:     <Ico d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  down:     <Ico d="M6 9l6 6 6-6" />,
  logout:   <Ico d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  connectors:<Ico d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />,
};

// ── Nav config ────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    section: 'Overview',
    items: [
      { path: '/', label: 'Dashboard',    icon: Icons.grid,     exact: true },
      { path: '/activity',      label: 'Activity Log',  icon: Icons.activity },
      { path: '/notifications', label: 'Notifications', icon: Icons.bell },
    ]
  },
  {
    section: 'AI Brain',
    items: [
      { path: '/identity',  label: 'Identity',       icon: Icons.user },
      { path: '/memory',    label: 'Memory',          icon: Icons.brain },
      { path: '/personas',  label: 'Personas',        icon: Icons.personas },
      { path: '/knowledge', label: 'Knowledge',       icon: Icons.book },
      { path: '/skills',    label: 'Skills',          icon: Icons.bolt },
    ]
  },
  {
    section: 'Gateway',
    items: [
      { path: '/access-tokens', label: 'Access Tokens',     icon: Icons.key },
      { path: '/tokens',        label: 'Token Vault',       icon: Icons.shield },
      { path: '/services',      label: 'Services',          icon: Icons.plug },
      { path: '/connectors',    label: 'Connectors',        icon: Icons.connectors },
      { path: '/devices',       label: 'Devices',           icon: Icons.terminal },
    ]
  },
  {
    section: 'Marketplace',
    items: [
      { path: '/marketplace',  label: 'Marketplace',   icon: Icons.store },
      { path: '/my-listings',  label: 'My Listings',   icon: Icons.list },
    ]
  },
  {
    section: 'Resources',
    items: [
      { path: '/platform-docs', label: 'Platform Docs', icon: Icons.docs },
      { path: '/api-docs',      label: 'API Docs',       icon: Icons.api },
    ]
  },
];

const ENTERPRISE_GROUP = {
  section: 'Workspace',
  items: [
    { path: '/settings/team', label: 'Team Settings',        icon: Icons.team },
    { path: '/enterprise',    label: 'Enterprise (SSO+RBAC)', icon: Icons.enterprise },
  ]
};

const ADMIN_GROUP = {
  section: 'Admin',
  items: [
    { path: '/users',   label: 'Users',   icon: Icons.users },
    { path: '/beta',    label: 'Beta',    icon: Icons.beta },
    { path: '/tickets', label: 'Tickets', icon: Icons.ticket },
  ]
};

// Page title map for the top bar
const PAGE_TITLES = {
  '/':               { title: 'Dashboard',      kicker: 'Overview' },
  '/activity':       { title: 'Activity Log',   kicker: 'Overview' },
  '/notifications':  { title: 'Notifications',  kicker: 'Overview' },
  '/identity':       { title: 'Identity',       kicker: 'AI Brain' },
  '/memory':         { title: 'Memory',         kicker: 'AI Brain' },
  '/personas':       { title: 'Personas',       kicker: 'AI Brain' },
  '/knowledge':      { title: 'Knowledge',      kicker: 'AI Brain' },
  '/skills':         { title: 'Skills',         kicker: 'AI Brain' },
  '/access-tokens':  { title: 'Access Tokens',  kicker: 'Gateway' },
  '/tokens':         { title: 'Token Vault',    kicker: 'Gateway' },
  '/services':       { title: 'Services',       kicker: 'Gateway' },
  '/connectors':     { title: 'Connectors',     kicker: 'Gateway' },
  '/devices':        { title: 'Devices',        kicker: 'Gateway' },
  '/marketplace':    { title: 'Marketplace',    kicker: null },
  '/my-listings':    { title: 'My Listings',    kicker: 'Marketplace' },
  '/platform-docs':  { title: 'Platform Docs',  kicker: 'Resources' },
  '/api-docs':       { title: 'API Docs',       kicker: 'Resources' },
  '/settings':       { title: 'Settings',       kicker: null },
  '/settings/team':  { title: 'Team Settings',  kicker: 'Workspace' },
  '/enterprise':     { title: 'Enterprise',     kicker: 'Workspace' },
  '/users':          { title: 'Users',          kicker: 'Admin' },
  '/beta':           { title: 'Beta',           kicker: 'Admin' },
  '/tickets':        { title: 'Tickets',        kicker: 'Admin' },
};

// ── Command Palette ───────────────────────────────────────────────────
function CmdPalette({ open, onClose, allItems }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = allItems.filter(i =>
    i.label.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--line)',
          borderRadius: '6px',
          width: '580px',
          maxWidth: '90vw',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b hairline">
          <span style={{ color: 'var(--ink-4)' }}>{Icons.search}</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Jump to page…"
            style={{ background: 'transparent', outline: 'none', flex: 1, fontSize: '14px', color: 'var(--ink)' }}
          />
          <kbd style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
            background: 'var(--bg-raised)', border: '1px solid var(--line)',
            borderBottomWidth: '2px', padding: '1px 5px', color: 'var(--ink-2)', borderRadius: '4px'
          }}>esc</kbd>
        </div>
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }} className="thin-scroll py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center" style={{ color: 'var(--ink-3)', fontSize: '13px' }}>
              No matches
            </div>
          )}
          {filtered.map(it => (
            <Link
              key={it.path}
              to={it.path}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-2 w-full text-left"
              style={{ fontSize: '13.5px', color: 'var(--ink-2)', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: 'var(--ink-3)' }}>{it.icon}</span>
              <span style={{ color: 'var(--ink)' }}>{it.label}</span>
              {it.kicker && (
                <span className="ml-auto micro">{it.kicker}</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Signal Tile ───────────────────────────────────────────────────────
function SignalTile({ label, value, unit, trend, muted }) {
  return (
    <div>
      <div className="micro mb-0.5">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="ink font-semibold" style={{ fontSize:'18px', lineHeight:1.2 }}>{value}</span>
        {unit && <span className="mono ink-3" style={{ fontSize:'11px' }}>{unit}</span>}
      </div>
      {trend && <div className={`mono text-[11px] mt-0.5 ${muted ? 'ink-4' : 'ink-3'}`}>{trend}</div>}
    </div>
  );
}

// ── Live Signal Rail ──────────────────────────────────────────────────
function LiveSignalRail({ masterToken }) {
  const [paused, setPaused] = useState(false);
  const [entries, setEntries] = useState([]);       // shown in list (40)
  const [allEntries, setAllEntries] = useState([]); // larger window for rpm/errors
  const [callsToday, setCallsToday] = useState(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const fetchAudit = useCallback(async () => {
    if (!masterToken) return;
    const headers = { 'Authorization': `Bearer ${masterToken}` };
    try {
      // fetch 40 for display and 500 for accurate stats
      const [listRes, statsRes, usageRes] = await Promise.all([
        fetch('/api/v1/audit?limit=40', { headers }),
        fetch('/api/v1/audit?limit=500', { headers }),
        fetch('/api/v1/billing/usage?range=1d', { headers }),
      ]);
      if (listRes.ok) {
        const d = await listRes.json();
        setEntries(Array.isArray(d) ? d : (d.entries || d.logs || d.data || []));
      }
      if (statsRes.ok) {
        const d = await statsRes.json();
        setAllEntries(Array.isArray(d) ? d : (d.entries || d.logs || d.data || []));
      }
      if (usageRes.ok) {
        const d = await usageRes.json();
        const total = d?.data?.totals?.monthlyApiCalls ?? d?.totals?.monthlyApiCalls ?? null;
        if (total !== null) setCallsToday(Number(total));
      }
    } catch {
      // silently ignore
    }
  }, [masterToken]);

  useEffect(() => {
    fetchAudit();
    const id = setInterval(() => { if (!pausedRef.current) fetchAudit(); }, 2800);
    return () => clearInterval(id);
  }, [fetchAudit]);

  const stats = useMemo(() => {
    const nowSec = Date.now() / 1000;
    const rpm = allEntries.filter(e => {
      const ts = e.timestamp || (e.created_at ? new Date(e.created_at).getTime() / 1000 : 0);
      return ts > 0 && (nowSec - ts) < 60;
    }).length;
    const errors = allEntries.filter(e => {
      const code = Number(e.status_code || e.statusCode || e.status || 0);
      return code >= 400;
    }).length;
    return { rpm, errors };
  }, [allEntries]);

  const fmtTime = (ts) => {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    catch { return ''; }
  };

  const methodColor = { GET: 'ink-2', POST: 'accent', DELETE: 'ink', PUT: 'accent', PATCH: 'accent' };

  return (
    <aside className="flex flex-col thin-scroll"
      style={{ width:'340px', flexShrink:0, borderLeft:'1px solid var(--line)', background:'var(--bg)', position:'sticky', top:0, height:'100vh' }}>

      {/* Header */}
      <div className="h-14 px-4 border-b hairline flex items-center gap-2" style={{ flexShrink:0 }}>
        <span className="live-dot tick" style={{ background:'var(--green)' }} />
        <span className="text-[13px] ink font-medium">Live signal</span>
        <span className="micro ink-3">api gateway</span>
        <button type="button" onClick={() => setPaused(p => !p)}
          className="btn btn-ghost ml-auto text-[12px] px-2 py-1">
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Stats row */}
      <div className="px-4 py-3 border-b hairline grid grid-cols-3 gap-3" style={{ flexShrink:0 }}>
        <SignalTile label="rpm"    value={stats.rpm}    trend="last 60s" />
        <SignalTile label="calls"  value={callsToday !== null ? callsToday : entries.length} trend={callsToday !== null ? 'today' : 'shown'} />
        <SignalTile label="errors" value={stats.errors} trend="4xx · 5xx" muted />
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto thin-scroll">
        {!masterToken && (
          <div className="px-4 py-8 text-center ink-3 text-[12.5px]">Connect to start seeing requests</div>
        )}
        {masterToken && entries.length === 0 && (
          <div className="px-4 py-8 text-center ink-3 text-[12.5px]">Waiting for requests…</div>
        )}
        {entries.map((entry, i) => {
          const rawMethod = (entry.method || entry.http_method || '').toUpperCase();
          const method = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(rawMethod) ? rawMethod : '—';
          const path   = entry.endpoint || entry.path || entry.resource_type || entry.url || entry.action || '';
          const scope  = entry.scope || entry.token_scope || '';
          const agent  = entry.ip || entry.ip_address || entry.user_id || 'api';
          const status = entry.statusCode || entry.status_code || entry.http_status || '';
          const ms     = entry.duration_ms || entry.ms || '';
          const ts     = entry.created_at || entry.timestamp || '';

          const sNum = Number(status);
          const sColor = sNum >= 500 ? 'var(--red)' : sNum >= 400 ? 'var(--amber)' : 'var(--ink-3)';
          const mCls = methodColor[method] || 'ink-2';

          return (
            <div key={entry.id || i}
              className={`px-4 py-2.5 border-b hairline-2 text-[12.5px]`}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-sunk)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div className="flex items-center gap-2">
                <span className={`mono font-medium ${mCls}`} style={{ minWidth:'44px' }}>{method}</span>
                <span className="mono" style={{ color: sColor }}>{status}</span>
                <span className="mono ink-4 ml-auto text-[10.5px]">{fmtTime(ts)}</span>
              </div>
              <div className="mono ink-2 mt-0.5 truncate" title={path}>{path || '—'}</div>
              <div className="flex items-center gap-2 mt-1 text-[11px] ink-3">
                <span className="ink-2 truncate" style={{ maxWidth:'90px' }}>{agent}</span>
                {scope && <><span>·</span><span className="mono truncate" style={{ maxWidth:'100px' }}>{scope}</span></>}
                {ms && <span className="mono ml-auto">{ms}ms</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t hairline px-4 py-2.5 text-[11.5px] ink-3 flex items-center gap-2" style={{ flexShrink:0 }}>
        <span>showing {entries.length} entries</span>
        <a href="/dashboard/activity" className="ml-auto ink-2 hover:underline"
          style={{ textDecoration:'none' }}
          onMouseEnter={e => { e.currentTarget.style.color='var(--ink)'; e.currentTarget.style.textDecoration='underline'; }}
          onMouseLeave={e => { e.currentTarget.style.color='var(--ink-2)'; e.currentTarget.style.textDecoration='none'; }}>
          Full audit log →
        </a>
      </div>
    </aside>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────
function Layout({ children, onLogout }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const masterToken = useAuthStore((state) => state.masterToken);
  const unreadCount = useNotificationStore(state => state.unreadCount);
  const fetchUnreadCount = useNotificationStore(state => state.fetchUnreadCount);
  const toasts = useNotificationStore(state => state.toasts) || [];
  const removeToast = useNotificationStore(state => state.removeToast);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  // Theme toggle
  const [theme, setTheme] = useState(() => {
    try { return JSON.parse(localStorage.getItem('myapi-ui-prefs') || '{}').theme || 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
    try {
      const prefs = JSON.parse(localStorage.getItem('myapi-ui-prefs') || '{}');
      localStorage.setItem('myapi-ui-prefs', JSON.stringify({ ...prefs, theme }));
    } catch { /* */ }
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  // Close avatar menu on outside click
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handler = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [avatarMenuOpen]);

  // Keyboard shortcut ⌘K / Ctrl+K for command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Fetch unread notifications
  useEffect(() => {
    fetchUnreadCount(masterToken);
    const interval = setInterval(() => fetchUnreadCount(masterToken), 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, masterToken]);

  const tokenData = (() => {
    try { return JSON.parse(localStorage.getItem('tokenData') || '{}'); } catch { return {}; }
  })();
  const isPowerUser = !!user?.isPowerUser;
  const effectivePlan = String(user?.plan || tokenData?.plan || 'free').toLowerCase();
  const hasEnterpriseAccess = effectivePlan === 'enterprise';

  const isActive = useCallback((path, exact = false) => {
    if (exact || path === '/') return location.pathname === path;
    return location.pathname.startsWith(path);
  }, [location.pathname]);

  // Build nav groups
  const navGroups = useMemo(() => {
    const groups = [...NAV_GROUPS];
    if (hasEnterpriseAccess) groups.push(ENTERPRISE_GROUP);
    if (isPowerUser) groups.push(ADMIN_GROUP);
    return groups;
  }, [hasEnterpriseAccess, isPowerUser]);

  // Flatten for command palette
  const allNavItems = useMemo(() => {
    return navGroups.flatMap(g =>
      g.items.map(i => ({ ...i, kicker: g.section }))
    );
  }, [navGroups]);

  // Current page info
  const pageInfo = useMemo(() => {
    const match = Object.entries(PAGE_TITLES)
      .filter(([path]) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname === path || location.pathname.startsWith(path + '/');
      })
      .sort((a, b) => b[0].length - a[0].length)[0];
    return match ? match[1] : { title: 'MyApi', kicker: null };
  }, [location.pathname]);

  const avatarUrl = useMemo(() => {
    const fromStorage = localStorage.getItem('profileAvatarUrl');
    return fromStorage || user?.avatarUrl || user?.avatar_url || '';
  }, [user]);

  const displayName = useMemo(() => {
    return user?.displayName || user?.display_name || user?.name || user?.username || 'User';
  }, [user]);

  const userInitial = displayName.slice(0, 1).toUpperCase();

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) onLogout();
  };

  // ── Sidebar ──────────────────────────────────────────────────────
  const Sidebar = ({ mobile = false }) => (
    <aside
      style={{
        width: mobile ? '100%' : '232px',
        flexShrink: 0,
        borderRight: mobile ? 'none' : '1px solid var(--line)',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        height: mobile ? 'auto' : '100vh',
        position: mobile ? 'static' : 'sticky',
        top: 0,
        overflowY: mobile ? 'auto' : 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--ink)' }}
        >
          <BrandLogo size="sm" withWordmark={false} />
          <span style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '-0.01em' }}>MyApi</span>
          <span style={{
            marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
            border: '1px solid var(--line)', padding: '1px 6px', borderRadius: '4px', color: 'var(--ink-3)'
          }}>v2.0</span>
        </Link>

        {/* Workspace switcher */}
        <div style={{ marginTop: '8px' }}>
          <WorkspaceSwitcher variant="menu" />
        </div>
      </div>

      {/* Nav groups */}
      <nav
        style={{ flex: 1, overflowY: 'auto', padding: '12px' }}
        className="thin-scroll"
      >
        {navGroups.map((group, gi) => (
          <div key={group.section} style={{ marginBottom: gi < navGroups.length - 1 ? '20px' : 0 }}>
            <div className="micro" style={{ padding: '0 8px', marginBottom: '4px' }}>
              {group.section}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {group.items.map(item => {
                const active = isActive(item.path, item.exact);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 8px', fontSize: '13.5px', textDecoration: 'none',
                        borderRadius: '4px', color: active ? 'var(--ink)' : 'var(--ink-2)',
                        background: active ? 'var(--bg-sunk)' : 'transparent',
                        transition: 'background 0.1s, color 0.1s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--ink)'; }}}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)'; }}}
                    >
                      <span style={{ color: active ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0 }}>
                        {item.icon}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                      {active && (
                        <span style={{
                          width: '3px', height: '14px', borderRadius: '999px',
                          background: 'var(--accent)', flexShrink: 0,
                        }} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User row */}
      <div style={{ borderTop: '1px solid var(--line)', padding: '10px 12px', paddingBottom: 'max(10px, calc(10px + env(safe-area-inset-bottom)))', flexShrink: 0 }}>
        <div className="relative" ref={mobile ? undefined : avatarMenuRef}>
          <button
            type="button"
            onClick={() => setAvatarMenuOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '6px 8px', borderRadius: '4px', cursor: 'pointer',
              background: 'transparent', border: 'none', color: 'var(--ink)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: 'var(--bg-raised)', border: '1px solid var(--line)',
                display: 'grid', placeItems: 'center',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--ink-2)', flexShrink: 0,
              }}>
                {userInitial}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1, textAlign: 'left', lineHeight: 1.3 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {effectivePlan} plan
              </div>
            </div>
            <span style={{ color: 'var(--ink-4)', flexShrink: 0 }}>{Icons.down}</span>
          </button>

          {/* Avatar dropdown */}
          {avatarMenuOpen && (
            <div
              style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px',
                background: 'var(--bg-raised)', border: '1px solid var(--line)',
                borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-2)' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email || user?.username}
                </div>
              </div>

              {[
                { path: '/settings', label: 'Settings' },
                { path: '/settings/team', label: 'Team & Members' },
                { path: '/my-listings', label: 'My Listings' },
              ].map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setAvatarMenuOpen(false)}
                  style={{
                    display: 'block', padding: '7px 14px',
                    fontSize: '13px', color: 'var(--ink-2)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--ink)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)'; }}
                >
                  {item.label}
                </Link>
              ))}

              <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => { setAvatarMenuOpen(false); handleLogout(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    width: '100%', padding: '7px 14px',
                    fontSize: '13px', color: 'var(--red)',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {Icons.logout}
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Desktop sidebar (left rail) */}
      <div className="hidden lg:block" style={{ position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden"
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSidebarOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '260px', height: '100dvh', overflowY: 'auto',
              background: 'var(--bg)', borderRight: '1px solid var(--line)',
            }}
            className="thin-scroll"
          >
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Center: topbar + scrollable content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          height: '56px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '0 24px', background: 'var(--bg)',
          position: 'sticky', top: 0, zIndex: 30, flexShrink: 0,
        }}>
          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: '4px', borderRadius: '4px' }}
          >
            {Icons.menu}
          </button>

          {/* Page title */}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, flex: 1, minWidth: 0 }}>
            {pageInfo.kicker && <span className="micro">{pageInfo.kicker}</span>}
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pageInfo.title}
            </span>
          </div>

          {/* ⌘K search bar */}
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="hidden md:flex"
            style={{
              alignItems: 'center', gap: '8px', padding: '5px 12px',
              fontSize: '13px', color: 'var(--ink-3)',
              border: '1px solid var(--line)', background: 'var(--bg-raised)',
              borderRadius: '6px', cursor: 'pointer', width: '320px',
            }}
          >
            <span style={{ color: 'var(--ink-4)' }}>{Icons.search}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>Search, jump, run command…</span>
            <span style={{ display: 'flex', gap: '3px' }}>
              {['⌘', 'K'].map(k => (
                <kbd key={k} style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
                  background: 'var(--bg)', border: '1px solid var(--line)',
                  borderBottomWidth: '2px', padding: '1px 4px',
                  color: 'var(--ink-3)', borderRadius: '3px',
                }}>{k}</kbd>
              ))}
            </span>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '4px',
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {theme === 'light' ? Icons.moon : Icons.sun}
          </button>

          {/* Notification bell */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setNotifOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '4px',
                background: notifOpen ? 'var(--bg-hover)' : 'transparent',
                border: 'none', cursor: 'pointer', color: 'var(--ink-3)',
                position: 'relative',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.background = 'transparent'; }}
              title="Notifications"
            >
              {Icons.bell}
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '2px', right: '2px',
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  fontSize: '9px', fontFamily: 'JetBrains Mono, monospace',
                  display: 'grid', placeItems: 'center',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationDropdown
              open={notifOpen}
              onClose={() => setNotifOpen(false)}
            />
          </div>

          {/* Settings shortcut */}
          <Link
            to="/settings"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '4px',
              color: isActive('/settings') ? 'var(--accent)' : 'var(--ink-3)',
              background: isActive('/settings') ? 'var(--bg-hover)' : 'transparent',
              textDecoration: 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => { if (!isActive('/settings')) e.currentTarget.style.background = 'transparent'; }}
            title="Settings"
          >
            {Icons.settings}
          </Link>
        </header>

        {/* Page content */}
        <main
          style={{ flex: 1, overflowY: 'auto', padding: '32px', boxSizing: 'border-box' }}
          className="thin-scroll"
        >
          <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Right Signal Stream Rail — hidden on mobile/tablet */}
      <div className="hidden xl:flex" style={{ flexShrink: 0 }}>
        <LiveSignalRail masterToken={masterToken} />
      </div>

      {/* Command palette */}
      <CmdPalette open={cmdOpen} onClose={() => setCmdOpen(false)} allItems={allNavItems} />

      {/* Toast container */}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 60, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px' }}>
        {toasts.map(toast => (
          <Toast key={toast.id} id={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      <CookieNotice />
      <PlanLimitModal />
    </div>
  );
}

export default Layout;
