import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';

// Platform-wide business analytics (power-user only). Recreation of the MyApi
// design-system `analytics.html` mock, bound to the real, aggregate, privacy-safe
// metrics from GET /api/v1/admin/analytics (KPIs + sparklines, growth area chart,
// plan/device donuts, API-call bars, ranked integration bars, marketplace table).

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MENU_SHADOW = '0 8px 24px rgba(0,0,0,0.4)';

const fmtN = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(n ?? 0);
const fmtFull = (n) => (typeof n === 'number' ? n.toLocaleString() : (n ?? '0'));

// ── inline-SVG charts (theme-aware, no external lib) ───────────────────────
const _max = (a) => Math.max(...(a.length ? a : [0]), 1);
const _path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

function Sparkline({ data = [], color = 'var(--accent)', w = 210, h = 34 }) {
  if (!data.length) return <div style={{ height: h }} />;
  const max = _max(data), min = Math.min(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)]);
  const id = 'sg' + Math.random().toString(36).slice(2, 8);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', overflow: 'visible' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={`${_path(pts)} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
      <path d={_path(pts)} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={color} />
    </svg>
  );
}

function AreaChart({ series = [], labels = [], color = 'var(--accent)', height = 196 }) {
  const [hi, setHi] = useState(null);
  if (!series.length) return <div style={{ height, color: 'var(--ink-4)', fontSize: 13, display: 'grid', placeItems: 'center' }}>No data</div>;
  const W = 720, H = height, padL = 8, padR = 8, padT = 12, padB = 22;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = _max(series), span = max || 1;
  const x = (i) => padL + (i / Math.max(1, series.length - 1)) * iw;
  const y = (v) => padT + ih - (v / span) * ih;
  const pts = series.map((v, i) => [x(i), y(v)]);
  const id = 'ag' + Math.random().toString(36).slice(2, 8);
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block' }}
        onMouseLeave={() => setHi(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - r.left) / r.width * W; const i = Math.round(((rel - padL) / iw) * (series.length - 1)); setHi(Math.max(0, Math.min(series.length - 1, i))); }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient></defs>
        {[0, 0.25, 0.5, 0.75, 1].map((g, i) => <line key={i} x1={padL} x2={W - padR} y1={padT + ih * g} y2={padT + ih * g} stroke="var(--line-2)" strokeWidth="1" />)}
        <path d={`${_path(pts)} L ${x(series.length - 1)} ${padT + ih} L ${padL} ${padT + ih} Z`} fill={`url(#${id})`} />
        <path d={_path(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hi != null && <>
          <line x1={x(hi)} x2={x(hi)} y1={padT} y2={padT + ih} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          <circle cx={x(hi)} cy={y(series[hi])} r="3.5" fill="var(--bg)" stroke={color} strokeWidth="2" />
        </>}
      </svg>
      {hi != null && (
        <div style={{ position: 'absolute', top: 6, left: `${(x(hi) / W) * 100}%`, transform: 'translateX(-50%)', pointerEvents: 'none',
          background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 8px', boxShadow: MENU_SHADOW, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink)' }}>{series[hi].toLocaleString()}</span>
          {labels[hi] && <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 6 }}>{labels[hi]}</span>}
        </div>
      )}
      {labels.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: MONO, fontSize: 10, color: 'var(--ink-4)' }}>
          {labels.filter((_, i) => i % Math.ceil(labels.length / 6) === 0).map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

function BarChart({ data = [], labels = [], color = 'var(--accent)', height = 150, fmt = fmtFull }) {
  const [hi, setHi] = useState(null);
  if (!data.length) return <div style={{ height, color: 'var(--ink-4)', fontSize: 13, display: 'grid', placeItems: 'center' }}>No data</div>;
  const max = _max(data);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height, position: 'relative' }}>
        {data.map((v, i) => (
          <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', position: 'relative', cursor: 'default' }}>
            {hi === i && (
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, zIndex: 5,
                background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap', boxShadow: MENU_SHADOW }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink)' }}>{fmt(v)}</span>
                {labels[i] && <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 5 }}>{labels[i]}</span>}
              </div>
            )}
            <div style={{ height: `${(v / max) * 100}%`, background: hi === i ? color : 'var(--accent-2)', opacity: hi === i ? 1 : 0.55,
              borderRadius: '3px 3px 0 0', transition: 'opacity .1s, background .1s', minHeight: 2 }} />
          </div>
        ))}
      </div>
      {labels.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: MONO, fontSize: 10, color: 'var(--ink-4)' }}>
          {labels.filter((_, i) => i % Math.ceil(labels.length / 7) === 0).map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

function Donut({ segments = [], size = 132, thickness = 18, centerLabel, centerSub }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2, C = 2 * Math.PI * r, cx = size / 2;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line-2)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const frac = s.value / total, dash = frac * C, off = acc * C; acc += frac;
          return <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} transform={`rotate(-90 ${cx} ${cx})`} strokeLinecap="butt" />;
        })}
        {centerLabel && <text x={cx} y={cx - 2} textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: 'var(--ink)' }}>{centerLabel}</text>}
        {centerSub && <text x={cx} y={cx + 15} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-3)', fontFamily: MONO, letterSpacing: '0.05em' }}>{centerSub}</text>}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 120, flex: 1 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{s.value.toLocaleString()}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink-4)', width: 38, textAlign: 'right' }}>{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HBars({ items = [], color = 'var(--accent)' }) {
  if (!items.length) return <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>No connections yet</div>;
  const max = _max(items.map((i) => i.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 124, flexShrink: 0 }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, background: it.chip, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: MONO, flexShrink: 0 }}>{it.glyph}</span>
            <span style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{it.label}</span>
          </div>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-sunk)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${(it.value / max) * 100}%`, height: '100%', background: it.color || color, borderRadius: 99 }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ink-2)', width: 52, textAlign: 'right', flexShrink: 0 }}>{it.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── building blocks ────────────────────────────────────────────────────────
const cardBase = { background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 10 };

function Kpi({ label, value, sub, delta, spark, color = 'var(--accent)' }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div style={{ ...cardBase, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="micro" style={{ whiteSpace: 'nowrap' }}>{label}</span>
        {delta != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 11, fontWeight: 600, color: up ? 'var(--green)' : 'var(--red)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d={up ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'} strokeLinecap="round" strokeLinejoin="round" /></svg>
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 27, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      <Sparkline data={spark} color={color} />
    </div>
  );
}

function Panel({ title, hint, right, children, pad = 18 }) {
  return (
    <div style={{ ...cardBase, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: `14px ${pad}px`, borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
          {hint && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{hint}</p>}
        </div>
        {right}
      </div>
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

function MiniStat({ label, value, sub }) {
  return (
    <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Deterministic chip/glyph/colour for a service name (real data has only counts).
const SERVICE_COLORS = ['var(--accent)', 'var(--violet)', 'var(--green)', 'var(--amber)', '#36C5F0', 'var(--ink-2)'];
const SERVICE_CHIPS = ['#1f6feb', '#5E6AD2', '#3fb950', '#d29922', '#36C5F0', '#30363d'];
function serviceVisual(name, i) {
  const clean = String(name || '?').replace(/^composio__/, '');
  const glyph = clean.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '?';
  return { chip: SERVICE_CHIPS[i % SERVICE_CHIPS.length], glyph, color: SERVICE_COLORS[i % SERVICE_COLORS.length] };
}

function PlatformView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  const load = useCallback((r) => {
    setLoading(true);
    apiClient.get(`/admin/analytics?range=${r}`)
      .then((res) => { setData(res.data); setError(null); })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  if (loading && !data) return <div style={{ color: 'var(--ink-3)' }}>Loading analytics…</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>{error}</div>;
  if (!data) return null;

  const { users = {}, monetization = {}, apiUsage = {}, integrations = {}, agents = {}, marketplace = {}, deltas = {}, series = {} } = data;
  const labels = series.dayLabels || [];
  const plan = users.byPlan || {};

  const planSeg = [
    { label: 'Personal', value: plan.free || 0, color: 'var(--ink-4)' },
    { label: 'Pro', value: plan.pro || 0, color: 'var(--accent)' },
    { label: 'Heavy', value: plan.enterprise || 0, color: 'var(--violet)' },
  ].filter((s) => s.value > 0 || true);

  const devColors = { desktop: 'var(--accent)', mobile: 'var(--green)', cli: 'var(--amber)', fingerprint: 'var(--ink-3)', asc: 'var(--violet)' };
  const devSeg = Object.entries(agents.activeDevicesByType || {}).map(([t, v]) => ({ label: t, value: v, color: devColors[t] || 'var(--ink-3)' }));
  const devTotal = devSeg.reduce((s, x) => s + x.value, 0);

  const integ = (integrations.topServices || []).slice(0, 6).map((s, i) => ({ label: s.service, value: s.connections, ...serviceVisual(s.service, i) }));
  const wauPct = users.total ? Math.round((users.activeWAU / users.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg, rgba(63,185,80,0.12))', border: '1px solid var(--green)', borderRadius: 999, padding: '2px 9px' }}>
            <span className="live-dot" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--green)' }} />Live
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Aggregate &amp; privacy-safe — no per-user data</span>
        </div>
        <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 8 }}>
          {['24h', '7d', '30d', '90d'].map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ padding: '4px 12px', fontSize: 12.5, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
              border: '1px solid transparent', background: range === r ? 'var(--bg-raised)' : 'transparent',
              color: range === r ? 'var(--ink)' : 'var(--ink-3)', boxShadow: range === r ? '0 1px 2px rgba(0,0,0,0.35)' : 'none' }}>{r}</button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <Kpi label="TOTAL USERS" value={fmtFull(users.total)} sub={`+${fmtFull(users.new7d)} this week`} delta={deltas.totalUsers} spark={users.cumulative} />
        <Kpi label="ACTIVE (WAU)" value={fmtFull(users.activeWAU)} sub={`${wauPct}% of users · 7d`} delta={deltas.activeWAU} spark={(users.cumulative || []).slice(-12)} color="var(--green)" />
        <Kpi label="API CALLS · 7D" value={fmtN(apiUsage.calls7d)} sub={`${fmtFull(apiUsage.avgCalls7dPerActiveUser)} / active user`} delta={deltas.apiCalls7d} spark={apiUsage.spark7} color="var(--violet)" />
        <Kpi label="MRR" value={`$${fmtN(monetization.mrrUsd)}`} sub={`${monetization.conversionRatePct ?? 0}% paid conversion`} delta={deltas.mrr} spark={monetization.mrrSeries} color="var(--amber)" />
      </div>

      {/* Growth + plan mix */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: 12 }}>
        <Panel title="User growth" hint={`Cumulative registered users · last ${range}`}
          right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-3)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} />Total users</span>}>
          <AreaChart series={users.cumulative} labels={labels} color="var(--accent)" />
        </Panel>
        <Panel title="Plan mix" hint="Paid conversion & subscriptions">
          <Donut segments={planSeg} centerLabel={`${monetization.conversionRatePct ?? 0}%`} centerSub="PAID" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
            <MiniStat label="Paid users" value={fmtFull(monetization.paidUsers)} />
            <MiniStat label="Active subs" value={fmtFull(monetization.activeSubscriptions)} />
          </div>
        </Panel>
      </div>

      {/* API usage */}
      <Panel title="API usage" hint="Token & agent calls per day — dashboard browsing excluded"
        right={<div style={{ display: 'flex', gap: 18 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>30d <b style={{ color: 'var(--ink)', fontFamily: MONO }}>{fmtN(apiUsage.calls30d)}</b></span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>7d <b style={{ color: 'var(--ink)', fontFamily: MONO }}>{fmtN(apiUsage.calls7d)}</b></span>
        </div>}>
        <BarChart data={apiUsage.callsPerDay} labels={labels} fmt={fmtFull} />
      </Panel>

      {/* Integrations + Agents */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 12 }}>
        <Panel title="Top integrations" hint="Service demand across all users — partnership & monetization signal">
          <HBars items={integ} />
        </Panel>
        <Panel title="Agents & devices" hint="Active scoped tokens & client mix">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <MiniStat label="Active tokens" value={fmtFull(agents.activeTokens)} sub="scoped, non-expired" />
            <MiniStat label="OAuth clients" value={fmtFull(agents.distinctOAuthClients)} sub="distinct apps" />
          </div>
          {devSeg.length > 0
            ? <Donut segments={devSeg} size={116} thickness={16} centerLabel={fmtN(devTotal)} centerSub="DEVICES" />
            : <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>No active devices</div>}
        </Panel>
      </div>

      {/* Marketplace */}
      <Panel title="Marketplace" hint="Published listings & install demand"
        right={<div style={{ display: 'flex', gap: 18 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Listings <b style={{ color: 'var(--ink)', fontFamily: MONO }}>{marketplace.publishedListings ?? 0}</b></span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Installs <b style={{ color: 'var(--ink)', fontFamily: MONO }}>{fmtN(marketplace.totalInstalls)}</b></span>
        </div>} pad={0}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '8px 18px', borderBottom: '1px solid var(--line-2)' }}>
            <span className="micro">Listing</span><span className="micro" style={{ textAlign: 'right' }}>Installs</span><span className="micro" style={{ width: 56, textAlign: 'right' }}>Rating</span>
          </div>
          {(marketplace.topListings || []).length === 0 ? (
            <div style={{ padding: '16px 18px', color: 'var(--ink-4)', fontSize: 13 }}>No published listings yet</div>
          ) : (marketplace.topListings).map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '11px 18px',
              borderBottom: i < marketplace.topListings.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink-4)', width: 16 }}>{i + 1}</span>
                <span style={{ fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 4, textTransform: 'capitalize',
                  background: 'var(--bg-sunk)', border: '1px solid var(--line-2)', color: 'var(--ink-3)' }}>{l.type}</span>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--ink-2)', textAlign: 'right' }}>{fmtFull(l.installs)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, width: 56, fontFamily: MONO, fontSize: 13, color: 'var(--amber)' }}>★ {l.rating || 0}</span>
            </div>
          ))}
        </div>
      </Panel>

      <p style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: MONO, margin: '4px 0 0' }}>
        Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : ''} · /api/v1/admin/analytics
      </p>
    </div>
  );
}

// ── Users view: per-user activation, retention & experience (owner-only) ─────
const STATUS_META = {
  active:          { label: 'Active',          color: 'var(--green)' },
  idle:            { label: 'Idle (8–30d)',    color: 'var(--amber)' },
  dormant:         { label: 'Dormant (>30d)',  color: 'var(--red)' },
  signed_up_idle:  { label: 'No activation',   color: 'var(--violet)' },
  never_returned:  { label: 'Never returned',  color: 'var(--ink-4)' },
};
const relDays = (d) => d == null ? '—' : d === 0 ? 'today' : d === 1 ? '1d ago' : d < 30 ? `${d}d ago` : d < 365 ? `${Math.round(d / 30)}mo ago` : `${Math.round(d / 365)}y ago`;

function StatusPill({ status }) {
  const m = STATUS_META[status] || { label: status, color: 'var(--ink-3)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: m.color,
      background: 'var(--bg-sunk)', border: `1px solid ${m.color}`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.color }} />{m.label}
    </span>
  );
}

function FunnelBar({ stage, users, pct, top }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 168, fontSize: 13, color: 'var(--ink-2)', flexShrink: 0 }}>{stage}</span>
      <div style={{ flex: 1, height: 26, background: 'var(--bg-sunk)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: top ? 'var(--accent)' : 'linear-gradient(90deg,var(--accent),var(--violet))', opacity: top ? 0.9 : 0.7, borderRadius: 6, minWidth: 2, transition: 'width .3s' }} />
        <span style={{ position: 'absolute', left: 10, top: 0, lineHeight: '26px', fontSize: 12, fontFamily: MONO, color: 'var(--ink)' }}>{fmtFull(users)}</span>
      </div>
      <span style={{ width: 52, textAlign: 'right', fontFamily: MONO, fontSize: 12.5, color: 'var(--ink-2)', flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

function UsersView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [range, setRange] = useState('30d');

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/admin/user-insights?range=${range}`)
      .then((res) => { setData(res.data); setError(null); })
      .catch((err) => setError(err.response?.status === 404
        ? 'User insights are part of the hosted MyApi Cloud edition and are not available on this server.'
        : (err.response?.data?.message || err.response?.data?.error || 'Failed to load user insights')))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <div style={{ color: 'var(--ink-3)' }}>Loading user insights…</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>{error}</div>;
  if (!data) return null;

  const { funnel = [], overall = {}, statusCounts = {}, users = [] } = data;
  const rangeLabel = data.rangeLabel || `last ${range}`;
  const activeInRange = (funnel[funnel.length - 1] || {}).users || 0;
  const ql = q.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (filter !== 'all' && u.status !== filter) return false;
    if (!ql) return true;
    return (u.email || '').toLowerCase().includes(ql) || (u.name || '').toLowerCase().includes(ql);
  });

  const td = { padding: '10px 12px', fontSize: 13, color: 'var(--ink-2)', borderBottom: '1px solid var(--line-2)', whiteSpace: 'nowrap' };
  const th = { padding: '8px 12px', textAlign: 'left', position: 'sticky', top: 0, background: 'var(--bg-raised)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Per-user activation, retention &amp; experience · contains emails — owner-only</span>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-sunk)', padding: 3, borderRadius: 8 }}>
          {['24h', '7d', '30d', '90d'].map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ padding: '4px 12px', fontSize: 12.5, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
              border: '1px solid transparent', background: range === r ? 'var(--bg-raised)' : 'transparent',
              color: range === r ? 'var(--ink)' : 'var(--ink-3)', boxShadow: range === r ? '0 1px 2px rgba(0,0,0,0.35)' : 'none' }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Activation summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <Kpi label="TOTAL USERS" value={fmtFull(data.users.length)} sub={`${overall.neverReturned || 0} never came back`} spark={[]} />
        <Kpi label="ACTIVATED" value={fmtFull(overall.activated)} sub={`${overall.activatedPct ?? 0}% connected or called`} spark={[]} color="var(--green)" />
        <Kpi label={`ACTIVE · ${range.toUpperCase()}`} value={fmtFull(activeInRange)} sub={`used it ${rangeLabel}`} spark={[]} color="var(--accent)" />
        <Kpi label="ERROR RATE" value={`${overall.errorRatePct ?? 0}%`} sub="of agent/API calls (4xx/5xx)" spark={[]} color={(overall.errorRatePct ?? 0) > 5 ? 'var(--red)' : 'var(--amber)'} />
      </div>

      {/* Funnel */}
      <Panel title="Activation funnel" hint="Where signed-up users drop off — signup → return → connect → call → active">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {funnel.map((f, i) => <FunnelBar key={f.stage} stage={f.stage} users={f.users} pct={f.pct} top={i === 0} />)}
        </div>
      </Panel>

      {/* Per-user table */}
      <Panel title="Users" hint={`${filtered.length} of ${users.length} shown`} pad={0}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}
              style={{ background: 'var(--bg-sunk)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 12.5 }}>
              <option value="all">All statuses</option>
              {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label} ({statusCounts[s] || 0})</option>)}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email / name…"
              style={{ background: 'var(--bg-sunk)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 10px', fontSize: 12.5, width: 200 }} />
          </div>
        }>
        <div style={{ overflowX: 'auto', maxHeight: 560, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-4)' }}>
                <th style={th}>User</th><th style={th}>Status</th><th style={th}>Plan</th>
                <th style={{ ...th, textAlign: 'right' }}>Signed up</th><th style={{ ...th, textAlign: 'right' }}>Last active</th>
                <th style={{ ...th, textAlign: 'right' }}>Services</th><th style={{ ...th, textAlign: 'right' }}>API calls</th>
                <th style={{ ...th, textAlign: 'right' }}>Errors</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ ...td, color: 'var(--ink-4)', textAlign: 'center' }}>No users match</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id}>
                  <td style={td}>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{u.email || u.name || u.id.slice(0, 8)}</div>
                    {u.name && u.email && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{u.name}</div>}
                  </td>
                  <td style={td}><StatusPill status={u.status} /></td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{u.plan}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: MONO, fontSize: 12 }}>{relDays(u.daysSinceSignup)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: MONO, fontSize: 12, color: u.status === 'active' ? 'var(--green)' : 'var(--ink-2)' }}>{relDays(u.daysSinceActive)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: MONO, fontSize: 12 }} title={(u.services || []).join(', ')}>{u.connectedServices}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: MONO, fontSize: 12 }}>{fmtFull(u.apiCallsTotal)}<span style={{ color: 'var(--ink-4)' }}> · {u.apiCallsWindow ?? u.apiCalls7d}/{range}</span></td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: MONO, fontSize: 12, color: u.errorCount > 0 ? 'var(--red)' : 'var(--ink-4)' }}>{u.errorCount ? `${u.errorCount} (${u.errorRatePct}%)` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: MONO, margin: '4px 0 0' }}>
        Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : ''} · /api/v1/admin/user-insights
      </p>
    </div>
  );
}

// ── Web view: Google Analytics (GA4) traffic & acquisition (owner-only) ──────
function WebView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/admin/ga-insights?range=${range}`)
      .then((res) => { setData(res.data); setError(null); })
      .catch((err) => setError(err.response?.status === 404
        ? { message: 'Web analytics are part of the hosted MyApi Cloud edition and are not available on this server.' }
        : (err.response?.data || { message: 'Failed to load Google Analytics' })))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <div style={{ color: 'var(--ink-3)' }}>Loading Google Analytics…</div>;
  if (error) return (
    <div style={{ ...cardBase, padding: 20 }}>
      <div style={{ color: 'var(--amber)', fontSize: 14, marginBottom: 8 }}>{error.message || error.error || 'Failed to load Google Analytics'}</div>
      {error.hint && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>{error.hint}</div>}
      {error.discoveryError && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: MONO, background: 'var(--bg-sunk)', border: '1px solid var(--line-2)', borderRadius: 6, padding: '8px 10px', marginBottom: 8, wordBreak: 'break-word' }}>
          {error.discoveryError}
        </div>
      )}
      {Array.isArray(error.properties) && error.properties.length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 8 }}>
          Found {error.properties.length} propert{error.properties.length === 1 ? 'y' : 'ies'}: {error.properties.map(p => `${p.name} (${p.id})`).join(', ')}
        </div>
      )}
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
        GA4 data is read through your <b>Composio “Google Analytics”</b> connection. If this fails, reconnect that
        toolkit in <b>Connectors</b>. Source data flows in from gtag <code style={{ fontFamily: MONO }}>G-W4J0S0HDJV</code>.
      </div>
    </div>
  );
  if (!data) return null;

  const t = data.totals || {};
  const fmtDur = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  const devColors = { desktop: 'var(--accent)', mobile: 'var(--green)', tablet: 'var(--amber)', smart: 'var(--violet)' };
  const devSeg = (data.byDevice || []).map((d, i) => ({ label: d.label, value: d.value, color: devColors[d.label] || SERVICE_COLORS[i % SERVICE_COLORS.length] }));
  const chan = (data.byChannel || []).map((c, i) => ({ label: c.label, value: c.value, ...serviceVisual(c.label, i) }));
  const ctry = (data.byCountry || []).map((c, i) => ({ label: c.label, value: c.value, ...serviceVisual(c.label, i) }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {data.realtimeActiveUsers != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--green)', background: 'rgba(63,185,80,0.12)', border: '1px solid var(--green)', borderRadius: 999, padding: '2px 9px' }}>
              <span className="live-dot" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--green)' }} />{data.realtimeActiveUsers} active now
            </span>
          )}
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{data.property?.name || 'GA4'} · via Google Analytics</span>
        </div>
        <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 8 }}>
          {['24h', '7d', '30d', '90d'].map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ padding: '4px 12px', fontSize: 12.5, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
              border: '1px solid transparent', background: range === r ? 'var(--bg-raised)' : 'transparent', color: range === r ? 'var(--ink)' : 'var(--ink-3)' }}>{r}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <Kpi label="ACTIVE USERS" value={fmtFull(t.activeUsers)} sub={`${fmtFull(t.newUsers)} new`} spark={data.series?.activeUsers || []} />
        <Kpi label="SESSIONS" value={fmtFull(t.sessions)} sub={`${t.engagementRatePct ?? 0}% engaged`} spark={data.series?.sessions || []} color="var(--violet)" />
        <Kpi label="PAGE VIEWS" value={fmtN(t.pageViews)} sub={`${fmtDur(t.avgSessionDurationSec || 0)} avg session`} spark={[]} color="var(--green)" />
        <Kpi label="BOUNCE RATE" value={`${t.bounceRatePct ?? 0}%`} sub="single-page sessions" spark={[]} color={(t.bounceRatePct ?? 0) > 60 ? 'var(--red)' : 'var(--amber)'} />
      </div>

      {/* Traffic over time */}
      <Panel title="Traffic" hint={`Active users per day · last ${data.range}`}>
        <AreaChart series={data.series?.activeUsers || []} labels={data.series?.labels || []} color="var(--accent)" />
      </Panel>

      {/* Acquisition + geography */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
        <Panel title="Acquisition channels" hint="How people arrive — sessions by channel">
          <HBars items={chan} />
        </Panel>
        <Panel title="Top countries" hint="Active users by country">
          <HBars items={ctry} />
        </Panel>
      </div>

      {/* Devices + top pages */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 12 }}>
        <Panel title="Devices" hint="Active users by device category">
          {devSeg.length ? <Donut segments={devSeg} centerLabel={fmtN(devSeg.reduce((s, x) => s + x.value, 0))} centerSub="USERS" /> : <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>No data</div>}
        </Panel>
        <Panel title="Top pages" hint="Most-viewed paths">
          <HBars items={(data.topPages || []).map((p, i) => ({ label: p.label, value: p.value, ...serviceVisual(p.label.replace(/^\//, '') || 'home', i) }))} />
        </Panel>
      </div>

      <p style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: MONO, margin: '4px 0 0' }}>
        Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : ''} · property {data.property?.id} · /api/v1/admin/ga-insights
      </p>
    </div>
  );
}

const TABS = [
  { id: 'platform', label: 'Platform', sub: 'Business & API metrics' },
  { id: 'users', label: 'Users', sub: 'Activation & retention' },
  { id: 'web', label: 'Web (GA)', sub: 'Google Analytics traffic' },
];

export default function Analytics() {
  const [tab, setTab] = useState('platform');
  const isPowerUser = useAuthStore((s) => s.user?.isPowerUser);
  const TITLES = { platform: 'Every call, counted.', users: 'Who actually shows up.', web: 'How the world arrives.' };

  // Owner-only surface. The API independently enforces this (requirePowerUser →
  // 403), so this is defense-in-depth + clean UX: non-owners never see the shell
  // or fire the data calls. `isPowerUser` is server-computed and not spoofable.
  if (!isPowerUser) {
    return (
      <div style={{ ...cardBase, padding: 24, maxWidth: 460, margin: '40px auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, color: 'var(--ink)', margin: '0 0 8px' }}>Restricted</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0 }}>Platform analytics are available to the workspace owner only.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ marginBottom: 4 }}>
        <div className="micro" style={{ marginBottom: 8 }}>ADMIN · ANALYTICS</div>
        <h1 className="font-serif" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)', margin: 0 }}>{TITLES[tab]}</h1>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)} title={tb.sub}
            style={{ padding: '8px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: 'transparent',
              border: 'none', borderBottom: `2px solid ${tab === tb.id ? 'var(--accent)' : 'transparent'}`,
              color: tab === tb.id ? 'var(--ink)' : 'var(--ink-3)', marginBottom: -1 }}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'platform' && <PlatformView />}
      {tab === 'users' && <UsersView />}
      {tab === 'web' && <WebView />}
    </div>
  );
}
