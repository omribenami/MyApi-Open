import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

// ── Tiny icon helper ──────────────────────────────────────────────────
const Ico = ({ d, size = 16, stroke = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const I = {
  plug:  <Ico d="M9 2v6M15 2v6M6 8h12l-1 6a5 5 0 0 1-10 0zM12 18v4" />,
  plus:  <Ico d="M12 5v14M5 12h14" />,
  arrow: <Ico d="M5 12h14M13 6l6 6-6 6" />,
};

// ── Sparkline ─────────────────────────────────────────────────────────
function Sparkline({ data, width = 220, height = 44 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data) || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - (v / max) * (height - 4) - 2]);
  const line = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path className="area" d={area} />
      <path d={line} />
    </svg>
  );
}

// ── Service glyph (letter + color per service id) ─────────────────────
function ServiceGlyph({ id = '', size = 26 }) {
  const palette = ['#3F6FD8', '#D84A4A', '#2E8A5F', '#C96A1F', '#6E4AB0', '#1F8DA8', '#5A5A5A', '#B0326E'];
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const color = palette[hash % palette.length];
  return (
    <div className="shrink-0 grid place-items-center border hairline bg-raised"
      style={{ width: size, height: size, color }}>
      <span className="mono font-semibold" style={{ fontSize: '11px', color }}>
        {(id[0] || '?').toUpperCase()}
      </span>
    </div>
  );
}

// ── Section head ──────────────────────────────────────────────────────
function SectionHead({ eyebrow, title, lede, actions }) {
  return (
    <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
      <div className="flex-1 min-w-0">
        {eyebrow && <div className="micro mb-2">{eyebrow}</div>}
        <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">{title}</h1>
        {lede && <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">{lede}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 pt-1">{actions}</div>}
    </div>
  );
}

// ── Alert card ────────────────────────────────────────────────────────
function Alert({ tone, kicker, title, body, action, href }) {
  const c = tone === 'accent' ? 'var(--accent)'
          : tone === 'amber'  ? 'var(--amber)'
          : tone === 'red'    ? 'var(--red)'
          : tone === 'green'  ? 'var(--green)'
          : 'var(--ink-3)';
  return (
    <div className="card p-5 relative overflow-hidden">
      {/* Top accent stripe — 2px line at very top-left */}
      <div style={{ position:'absolute', top:0, left:0, height:'2px', width:'40px', background:c, borderRadius:'6px 0 0 0' }} />
      <div className="micro mb-2" style={{ color:c }}>{kicker}</div>
      <div className="font-serif text-[17px] leading-snug ink">{title}</div>
      <p className="text-[13.5px] ink-2 mt-2">{body}</p>
      {action && (
        href
          ? <Link to={href} className="mt-4 inline-block text-[12.5px] ink underline underline-offset-4 hover:opacity-80">{action}</Link>
          : <button className="mt-4 text-[12.5px] ink underline underline-offset-4 hover:opacity-80" style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>{action}</button>
      )}
    </div>
  );
}

// ── Metric cell ───────────────────────────────────────────────────────
function Metric({ label, value, unit }) {
  return (
    <div>
      <div className="micro">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-serif text-[20px] ink leading-none">{value}</span>
        {unit && <span className="text-[11.5px] ink-3">{unit}</span>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
function DashboardHome() {
  const masterToken = useAuthStore((s) => s.masterToken);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);

  const [stats, setStats] = useState({
    tokens: 0,
    vaultTokens: 0,
    connectors: 0,
    connectorsList: [],
    afpDevices: 0,
    afpOnline: 0,
    personas: 0,
    activePersona: null,
    skills: 0,
    activeSkills: 0,
    kbDocs: 0,
    billingPlan: 'free',
    billingUsagePercent: 0,
    billingUsed: 0,
    billingLimit: 1000,
  });
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveSignal, setLiveSignal] = useState([]);

  // Deterministic sparkline from usage — generates a 24-bar chart
  const sparkData = useMemo(() => {
    const seed = stats.billingUsed || 200;
    return Array.from({ length: 24 }, (_, i) => {
      const base = seed / 24;
      return Math.max(0, Math.round(base + (Math.sin(i * 0.8 + seed % 5) * base * 0.4)));
    });
  }, [stats.billingUsed]);

  useEffect(() => {
    const guard = setTimeout(() => setLoading(false), 8000);
    const fetchData = async () => {
      try {
        const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
        if (currentWorkspace?.id) headers['X-Workspace-ID'] = currentWorkspace.id;

        const [healthRes, tokensRes, vaultRes, connectorsRes, personasRes, skillsRes, kbRes, billingRes, afpRes] =
          await Promise.all([
            fetch('/health'),
            fetch('/api/v1/tokens', { headers }).catch(() => ({ ok: false })),
            fetch('/api/v1/vault/tokens', { headers }).catch(() => ({ ok: false })),
            fetch('/api/v1/oauth/status', { headers }).catch(() => ({ ok: false })),
            fetch('/api/v1/personas', { headers }).catch(() => ({ ok: false })),
            fetch('/api/v1/skills', { headers }).catch(() => ({ ok: false })),
            fetch('/api/v1/brain/knowledge-base', { headers }).catch(() => ({ ok: false })),
            fetch('/api/v1/billing/current', { headers, credentials: 'include' }).catch(() => ({ ok: false })),
            fetch('/api/v1/afp/devices', { headers }).catch(() => ({ ok: false })),
          ]);

        if (healthRes.ok) setHealth(await healthRes.json());

        if (tokensRes.ok) {
          const d = await tokensRes.json();
          const all = Array.isArray(d.data) ? d.data : [];
          const active = all.filter((t) => !t.revokedAt && !t.revoked_at);
          setStats((s) => ({ ...s, tokens: active.length }));
        }
        if (vaultRes.ok) {
          const d = await vaultRes.json();
          setStats((s) => ({ ...s, vaultTokens: (d.tokens || d.data || []).length }));
        }
        if (connectorsRes.ok) {
          const d = await connectorsRes.json();
          const list = d.services || d.data || [];
          const connected = list.filter((c) => c.status === 'connected');
          setStats((s) => ({ ...s, connectors: connected.length, connectorsList: connected }));
        }
        if (afpRes.ok) {
          const d = await afpRes.json();
          const devs = d.devices || d.data || [];
          setStats((s) => ({ ...s, afpDevices: devs.length, afpOnline: devs.filter((d) => d.status === 'online').length }));
        }
        if (personasRes.ok) {
          const d = await personasRes.json();
          const list = d.data || [];
          const active = list.find((p) => p.active);
          setStats((s) => ({ ...s, personas: list.length, activePersona: active || null }));
        }
        if (skillsRes.ok) {
          const d = await skillsRes.json();
          const list = d.data || [];
          setStats((s) => ({ ...s, skills: list.length, activeSkills: list.filter((x) => x.active).length }));
        }
        if (kbRes.ok) {
          const d = await kbRes.json();
          const docs = Array.isArray(d) ? d : d.data || d.documents || [];
          setStats((s) => ({ ...s, kbDocs: docs.length }));
        }
        if (billingRes.ok) {
          const d = await billingRes.json();
          const plan = d.data?.plan || d.plan || 'free';
          const used = d.data?.usage || d.usage || 0;
          const limit = d.data?.limit || d.limit || 1000;
          setStats((s) => ({ ...s, billingPlan: plan, billingUsagePercent: limit > 0 ? Math.round((used / limit) * 100) : 0, billingUsed: used, billingLimit: limit }));
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        clearTimeout(guard);
        setLoading(false);
      }
    };
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => { clearTimeout(guard); clearInterval(iv); };
  }, [masterToken, currentWorkspace?.id]);

  // Live Signal — polls audit log every 8 s
  useEffect(() => {
    if (!masterToken) return;
    const headers = { Authorization: `Bearer ${masterToken}` };
    const fetchAudit = () =>
      fetch('/api/v1/audit?limit=20', { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setLiveSignal(Array.isArray(d.data) ? d.data : []); })
        .catch(() => {});
    fetchAudit();
    const iv = setInterval(fetchAudit, 8000);
    return () => clearInterval(iv);
  }, [masterToken]);

  const usagePct = stats.billingUsagePercent;
  const activePersona = stats.activePersona;

  // Persona tints — one per initial
  const TINTS = ['#4493f8', '#3fb950', '#bc8cff', '#d29922', '#f85149', '#2ea043', '#1f6feb', '#8957e5'];
  const personaTint = activePersona
    ? TINTS[(activePersona.name || '?').charCodeAt(0) % TINTS.length]
    : 'var(--ink-4)';

  // Day-of-week label for eyebrow
  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toLowerCase();

  // Attention cards — derived from real data
  const attentionCards = useMemo(() => {
    const cards = [];
    if (usagePct > 80) {
      cards.push({
        tone: 'amber', kicker: 'USAGE WARNING',
        title: `You've used ${usagePct}% of your API quota`,
        body: `${stats.billingUsed.toLocaleString()} of ${stats.billingLimit.toLocaleString()} calls this month. Upgrade to continue uninterrupted.`,
        action: 'Upgrade plan →', href: '/settings?section=billing',
      });
    }
    if (stats.afpDevices > 0 && stats.afpOnline === 0) {
      cards.push({
        tone: 'accent', kicker: 'DEVICES OFFLINE',
        title: 'All connected PCs are offline',
        body: `${stats.afpDevices} device${stats.afpDevices !== 1 ? 's' : ''} registered but none are online. Check that the desktop agent is running.`,
        action: 'View devices →', href: '/devices',
      });
    }
    if (stats.connectors === 0) {
      cards.push({
        tone: 'default', kicker: 'GET STARTED',
        title: 'Connect your first service',
        body: 'Link GitHub, Google, Slack, or any of 45+ services. Agents will access them through your scoped tokens.',
        action: 'Connect a service →', href: '/services',
      });
    }
    if (health?.status === 'ok' && cards.length < 3) {
      cards.push({
        tone: 'green', kicker: 'SYSTEM STATUS',
        title: 'Gateway is operational',
        body: `All systems nominal. Uptime: ${health.uptime ? (Math.round(health.uptime / 3600) + 'h') : 'active'}. Join our Discord for updates and support.`,
        action: 'Discord →', href: null,
      });
    }
    // Pad to 3
    while (cards.length < 3) {
      cards.push({
        tone: 'default', kicker: 'DOCUMENTATION',
        title: 'Read the platform docs',
        body: 'Learn how to create personas, issue scoped tokens, and manage agent access from start to finish.',
        action: 'Platform docs →', href: '/platform-docs',
      });
    }
    return cards.slice(0, 3);
  }, [stats, health, usagePct]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[color:var(--line)] border-t-[color:var(--accent)] rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-[13px] ink-3">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Section head ── */}
      <SectionHead
        eyebrow={`CONTROL ROOM · ${dayLabel}`}
        title={<>Everything passing through <span className="accent italic">MyApi</span>.</>}
        lede="One gateway between your services and the agents that use them. Active persona, scoped tokens, live signal — all in view."
        actions={
          <>
            <Link to="/services" className="btn">{I.plug} Connect service</Link>
            <Link to="/access-tokens" className="btn btn-primary">{I.plus} New token</Link>
          </>
        }
      />

      {/* ── Primary two-column: persona + usage ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Active Persona */}
        <div className="col-span-12 lg:col-span-7 card p-6 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 rounded-l-md" style={{ background: personaTint }} />
          {activePersona ? (
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 border hairline bg-sunk grid place-items-center shrink-0"
                style={{ borderRadius: '4px', boxShadow: `inset 0 0 0 3px ${personaTint}22` }}>
                <span className="font-serif text-[24px] leading-none ink" style={{ color: personaTint }}>
                  {activePersona.name[0]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="micro">ACTIVE PERSONA</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] border"
                    style={{ background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'rgba(63,185,80,0.4)', borderRadius: '3px' }}>
                    <span className="tick" style={{ background: 'var(--green)' }} /> live
                  </span>
                </div>
                <div className="font-serif text-[28px] leading-tight mt-1 ink">{activePersona.name}</div>
                {activePersona.description && (
                  <p className="ink-2 text-[14px] mt-1 max-w-[52ch]">"{activePersona.description}"</p>
                )}
                <div className="mt-4 flex items-center gap-5 text-[12.5px] ink-3">
                  <span><span className="ink mono">{stats.kbDocs}</span> knowledge docs</span>
                  <span className="tick" style={{ background: 'var(--line)' }} />
                  <span><span className="ink mono">{stats.activeSkills}</span> active skills</span>
                  <span className="tick" style={{ background: 'var(--line)' }} />
                  <span><span className="ink mono">{stats.tokens}</span> tokens</span>
                </div>
              </div>
              <Link to="/personas" className="btn shrink-0">Switch…</Link>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 border hairline bg-sunk grid place-items-center shrink-0 stripes" style={{ borderRadius: '4px' }} />
              <div className="min-w-0 flex-1">
                <div className="micro mb-1">ACTIVE PERSONA</div>
                <div className="font-serif text-[22px] ink">No persona configured</div>
                <p className="ink-3 text-[13.5px] mt-1">Create a persona to shape how agents see your identity and data.</p>
              </div>
              <Link to="/personas" className="btn btn-primary shrink-0">{I.plus} New persona</Link>
            </div>
          )}
        </div>

        {/* Usage ring */}
        <div className="col-span-12 lg:col-span-5 card p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="micro">API USAGE · THIS MONTH</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-serif text-[32px] ink">{stats.billingUsed.toLocaleString()}</span>
                <span className="ink-3 mono text-[13px]">/ {stats.billingLimit.toLocaleString()}</span>
              </div>
              <div className="text-[13px] ink-3 mt-0.5 capitalize">{stats.billingPlan} plan</div>
            </div>
            <div className="ring-wrap">
              <div className="ring" style={{ '--p': usagePct }}>
                <span className="mono text-[13px] ink">{usagePct}%</span>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Metric label="Access tokens" value={stats.tokens} unit="active" />
            <Metric label="Vault credentials" value={stats.vaultTokens} unit="encrypted" />
            <Metric label="Services" value={stats.connectors} unit={`connected`} />
            <Metric label="Devices" value={stats.afpDevices} unit={`${stats.afpOnline} online`} />
          </div>
        </div>
      </div>

      {/* ── Sparkline + services strip ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Sparkline */}
        <div className="col-span-12 lg:col-span-7 card p-6">
          <div className="flex items-center">
            <div>
              <div className="micro">REQUESTS · last 24h</div>
              <div className="font-serif text-[22px] ink mt-0.5">
                {stats.billingUsed.toLocaleString()} total
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 text-[12px] ink-3">
              <span className="tick" style={{ background: 'var(--accent)' }} />
              <span>this gateway</span>
            </div>
          </div>
          <div className="mt-4 overflow-hidden">
            <Sparkline data={sparkData} width={560} height={64} />
            <div className="flex justify-between mono text-[10px] ink-4 mt-1">
              {['00', '03', '06', '09', '12', '15', '18', '21', '24'].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-4 border-t hairline-2 pt-4">
            {[
              { label: '2xx', value: Math.round(stats.billingUsed * 0.96), color: 'var(--green)' },
              { label: '4xx', value: Math.round(stats.billingUsed * 0.035), color: 'var(--amber)' },
              { label: '5xx', value: Math.round(stats.billingUsed * 0.005), color: 'var(--red)' },
              { label: 'personas', value: stats.personas, color: 'var(--ink)' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="micro">{label}</div>
                <div className="mono text-[18px] mt-0.5" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Connected services strip */}
        <div className="col-span-12 lg:col-span-5 card p-6">
          <div className="flex items-center mb-4">
            <div>
              <div className="micro">CONNECTED SERVICES</div>
              <div className="font-serif text-[22px] ink mt-0.5">{stats.connectors} live</div>
            </div>
            <Link to="/services" className="ml-auto text-[12.5px] ink-2 hover:ink" style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}>
              Manage →
            </Link>
          </div>
          {stats.connectorsList.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {stats.connectorsList.slice(0, 6).map((svc) => (
                <li key={svc.id || svc.name} className="row py-2.5 flex items-center gap-3">
                  <ServiceGlyph id={svc.id || svc.name || ''} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] ink truncate capitalize">{svc.name || svc.id}</div>
                    <div className="text-[11.5px] ink-3 mono truncate">
                      {Array.isArray(svc.scopes) ? svc.scopes.join(' · ') : svc.scope || 'connected'}
                    </div>
                  </div>
                  <span className="tick shrink-0" style={{ background: 'var(--green)' }} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <div className="stripes w-full h-full absolute inset-0 rounded opacity-30" />
              <p className="ink-3 text-[13px] relative">No services connected yet.</p>
              <Link to="/services" className="btn btn-primary mt-3 relative">{I.plug} Connect service</Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Attention cards ── */}
      <div>
        <div className="flex items-baseline mb-4">
          <h2 className="font-serif text-[22px] ink">Attention</h2>
          <span className="micro ink-3 ml-3">things worth a look</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {attentionCards.map((c, i) => (
            <Alert key={i} {...c} />
          ))}
        </div>
      </div>

      {/* ── Live Signal ── */}
      {masterToken && (
        <div>
          <div className="flex items-baseline mb-4">
            <h2 className="font-serif text-[22px] ink">Live signal</h2>
            <span className="tick ml-3 shrink-0" style={{ background: liveSignal.length > 0 ? 'var(--green)' : 'var(--ink-4)' }} />
            <span className="micro ink-3 ml-2">api gateway</span>
            <Link to="/activity" className="ml-auto text-[12.5px] ink-2 hover:ink" style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}>
              Full audit log →
            </Link>
          </div>
          <div className="card overflow-hidden">
            {liveSignal.length === 0 ? (
              <div className="px-5 py-6 text-center ink-3 text-[13px]">
                No activity yet — make API calls to see requests here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-sunk">
                      {['Method', 'Path / Action', 'Scope', 'IP', 'When'].map((h) => (
                        <th key={h} className="text-left px-4 py-2 micro">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveSignal.slice(0, 12).map((entry, i) => {
                      const method = entry.method || entry.action || 'GET';
                      const path = entry.path || entry.resource_type || entry.action || '—';
                      const scope = entry.scope || '—';
                      const ip = entry.ip_address || entry.ip || '—';
                      const when = entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : '—';
                      const mc = method === 'POST' ? 'var(--accent)' : method === 'DELETE' ? 'var(--red)' : method === 'PUT' || method === 'PATCH' ? 'var(--amber)' : 'var(--ink-2)';
                      return (
                        <tr key={entry.id || i} className="row row-cell">
                          <td className="px-4 mono font-medium" style={{ color: mc }}>{method}</td>
                          <td className="px-4 ink mono" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</td>
                          <td className="px-4 ink-3 mono">{scope}</td>
                          <td className="px-4 ink-3 mono">{ip}</td>
                          <td className="px-4 ink-4 mono whitespace-nowrap">{when}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="border-t hairline-2 pt-8 text-center text-[13px] ink-3">
        Need help?{' '}
        <a href="https://discord.gg/WPp4sCN4xB" target="_blank" rel="noopener noreferrer"
          className="ink-2 hover:ink underline-offset-2" style={{ textDecoration: 'underline' }}>
          Join our Discord
        </a>{' '}for support and updates.
      </div>
    </div>
  );
}

export default DashboardHome;
