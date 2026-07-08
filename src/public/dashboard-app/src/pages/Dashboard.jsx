import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import AlertBanner from '../components/AlertBanner';
import PendingInvitations from '../components/PendingInvitations';
import { useAuthStore } from '../stores/authStore';

// ─────────────────────────────────────────────────────────────────────────
// Device Activity — a personal control surface for the Gateway.
// "Which of my devices & agents are calling the API — and what are they
//  calling?" The hero donut splits calls by device; click a slice (or a
// table row / legend item) to drill into that device's calls by service.
// All panels stay linked to the selection. Every number is real, pulled from
// /dashboard/device-activity (the user's own audit log — never dashboard
// browsing). Admin broadcasts surface in the Insights & alerts strip.
// ─────────────────────────────────────────────────────────────────────────

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const MENU_SHADOW = '0 8px 24px rgba(0,0,0,0.4)';

// ── service catalog (the things a device can call) ───────────────────────
const SVC_META = {
  github: { label: 'GitHub', color: 'var(--ink-2)', chip: '#30363d', glyph: 'GH' },
  google: { label: 'Google', color: 'var(--accent)', chip: '#4285F4', glyph: 'G' },
  gmail: { label: 'Gmail', color: 'var(--red)', chip: '#EA4335', glyph: 'M' },
  slack: { label: 'Slack', color: '#36C5F0', chip: '#1f6feb', glyph: 'S' },
  notion: { label: 'Notion', color: 'var(--ink)', chip: '#161b22', glyph: 'N' },
  linear: { label: 'Linear', color: 'var(--violet)', chip: '#5E6AD2', glyph: 'L' },
  stripe: { label: 'Stripe', color: 'var(--amber)', chip: '#635bff', glyph: 'St' },
  calendar: { label: 'Calendar', color: 'var(--green)', chip: '#0F9D58', glyph: 'C' },
  drive: { label: 'Drive', color: 'var(--amber)', chip: '#FBBC05', glyph: 'D' },
};
const SVC_PALETTE = ['var(--accent)', 'var(--violet)', 'var(--green)', 'var(--amber)', '#36C5F0', '#B0326E', 'var(--ink-3)'];
const DEV_COLORS = ['var(--accent)', 'var(--violet)', 'var(--green)', 'var(--amber)', '#36C5F0', 'var(--ink-3)', '#B0326E'];

const titleCase = (s) => String(s || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const hashIdx = (s, n) => ([...String(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0)) % n;
function svcMeta(key) {
  if (SVC_META[key]) return SVC_META[key];
  const color = SVC_PALETTE[hashIdx(key, SVC_PALETTE.length)];
  return { label: titleCase(key), color, chip: '#30363d', glyph: (key[0] || '?').toUpperCase() };
}

const fmtN = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(n));
const fmtFull = (n) => Number(n || 0).toLocaleString();

const STATUS = {
  active: { tone: 'success', label: 'Active', live: true, color: 'var(--green)', bg: 'var(--green-bg)' },
  idle: { tone: 'warning', label: 'Idle', live: false, color: 'var(--amber)', bg: 'var(--amber-bg)' },
  paused: { tone: 'neutral', label: 'Dormant', live: false, color: 'var(--ink-3)', bg: 'var(--bg-sunk)' },
};

// ── tiny inline-SVG chart primitives (theme-aware, no chart lib) ──────────
function Ico({ d, size = 16, stroke = 1.7, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={d} />
    </svg>
  );
}

function Sparkline({ data = [], color = 'var(--accent)', w = 210, h = 34 }) {
  const path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  if (!data || data.length < 2) {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%' }}>
      <line x1="0" y1={h - 3} x2={w} y2={h - 3} stroke="var(--line)" strokeWidth="1" /></svg>;
  }
  const max = Math.max(...data, 1), min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)]);
  const id = 'sg' + Math.random().toString(36).slice(2, 8);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', overflow: 'visible' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={`${path(pts)} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
      <path d={path(pts)} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={color} />
    </svg>
  );
}

function BarChart({ data = [], labels = [], color = 'var(--accent)', height = 150, fmt = fmtFull }) {
  const [hi, setHi] = useState(null);
  const max = Math.max(...data, 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height, position: 'relative' }}>
        {data.map((v, i) => (
          <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', position: 'relative' }}>
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

function HBars({ items = [], color = 'var(--accent)' }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>No service calls recorded in this window.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 108, flexShrink: 0 }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, background: it.chip, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: MONO, flexShrink: 0 }}>{it.glyph}</span>
            <span style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          </div>
          <div style={{ flex: 1, height: 8, background: 'var(--bg-sunk)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${(it.value / max) * 100}%`, height: '100%', background: it.color || color, borderRadius: 99 }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--ink-2)', width: 52, textAlign: 'right', flexShrink: 0 }}>{fmtFull(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

// DrillDonut — clickable donut that drills from device → its services.
function DrillDonut({ groups, selectedKey = null, onSelect, size = 248, thickness = 38, fmt = fmtN }) {
  const [hi, setHi] = useState(null);
  const sel = groups.find((g) => g.key === selectedKey) || null;
  const level = sel ? sel.children : groups;
  const drillable = !sel;
  const total = level.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2, rOut = size / 2 - 4, rIn = rOut - thickness;
  let a = -Math.PI / 2;
  const arcs = level.map((seg) => {
    const frac = seg.value / total;
    const a0 = a, a1 = a + frac * Math.PI * 2;
    a = a1;
    return { ...seg, a0, a1, frac, mid: (a0 + a1) / 2 };
  });
  const polar = (r, ang) => [cx + r * Math.cos(ang), size / 2 + r * Math.sin(ang)];
  const arcPath = (a0, a1) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0o, y0o] = polar(rOut, a0), [x1o, y1o] = polar(rOut, a1);
    const [x1i, y1i] = polar(rIn, a1), [x0i, y0i] = polar(rIn, a0);
    return `M${x0o.toFixed(2)} ${y0o.toFixed(2)} A${rOut} ${rOut} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)} L${x1i.toFixed(2)} ${y1i.toFixed(2)} A${rIn} ${rIn} 0 ${large} 0 ${x0i.toFixed(2)} ${y0i.toFixed(2)} Z`;
  };
  const active = hi != null ? arcs[hi] : null;
  const centerVal = active ? active.value : total;
  const centerLab = active ? active.label : sel ? sel.label : 'All devices';
  const centerSub = active ? `${Math.round(active.frac * 100)}% of ${sel ? 'device' : 'calls'}` : sel ? 'CALLS' : 'TOTAL CALLS';

  if (total <= 0 || arcs.length === 0) {
    return <div style={{ height: size, display: 'grid', placeItems: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No API calls in this window.</div>;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }} onMouseLeave={() => setHi(null)}>
        {arcs.map((s, i) => {
          const isHi = hi === i;
          const dx = Math.cos(s.mid) * (isHi ? 5 : 0), dy = Math.sin(s.mid) * (isHi ? 5 : 0);
          return (
            <path key={s.key} d={arcPath(s.a0, s.a1)} fill={s.color} stroke="var(--bg-raised)" strokeWidth="2" strokeLinejoin="round"
              onMouseEnter={() => setHi(i)} onClick={() => drillable && onSelect && onSelect(s.key)}
              style={{ cursor: drillable ? 'pointer' : 'default', transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`, transition: 'transform .12s ease, opacity .12s', opacity: hi == null || isHi ? 1 : 0.55 }} />
          );
        })}
        <g onClick={() => sel && onSelect && onSelect(null)} style={{ cursor: sel ? 'pointer' : 'default' }}>
          <circle cx={cx} cy={cx} r={rIn - 1} fill="transparent" />
          {sel && <text x={cx} y={cx - 26} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--accent)', fontFamily: MONO, letterSpacing: '0.04em' }}>‹ ALL DEVICES</text>}
          <text x={cx} y={cx - 2} textAnchor="middle" style={{ fontSize: 26, fontWeight: 700, fill: 'var(--ink)', letterSpacing: '-0.02em' }}>{fmt(centerVal)}</text>
          <text x={cx} y={cx + 16} textAnchor="middle" style={{ fontSize: 11.5, fill: 'var(--ink-2)' }}>{centerLab}</text>
          <text x={cx} y={cx + 31} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-4)', fontFamily: MONO, letterSpacing: '0.06em' }}>{centerSub}</text>
        </g>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 150, flex: 1 }}>
        {arcs.map((s, i) => (
          <div key={s.key} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => drillable && onSelect && onSelect(s.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '3px 6px', borderRadius: 6, minWidth: 0, cursor: drillable ? 'pointer' : 'default', background: hi === i ? 'var(--bg-hover)' : 'transparent', transition: 'background .1s' }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--ink)', fontWeight: 500 }}>{fmt(s.value)}</span>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--ink-4)', width: 34, textAlign: 'right' }}>{Math.round(s.frac * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── small building blocks ────────────────────────────────────────────────
function Badge({ tone = 'neutral', dot, live, children }) {
  const map = {
    success: { c: 'var(--green)', bg: 'var(--green-bg)', b: 'rgba(63,185,80,0.4)' },
    warning: { c: 'var(--amber)', bg: 'var(--amber-bg)', b: 'rgba(210,153,34,0.4)' },
    neutral: { c: 'var(--ink-3)', bg: 'var(--bg-sunk)', b: 'var(--line)' },
  }[tone] || { c: 'var(--ink-3)', bg: 'var(--bg-sunk)', b: 'var(--line)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', fontSize: 11, borderRadius: 5, border: `1px solid ${map.b}`, background: map.bg, color: map.c }}>
      {dot && <span className={live ? 'tick live-dot' : 'tick'} style={{ background: map.c }} />}{children}
    </span>
  );
}

function Panel({ title, hint, right, children, pad = 18 }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: `13px ${pad}px`, borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
          {hint && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{hint}</p>}
        </div>
        {right}
      </div>
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub, delta, spark, color = 'var(--accent)', tone }) {
  const up = (delta || 0) >= 0;
  const dCol = tone === 'inverse' ? (up ? 'var(--red)' : 'var(--green)') : (up ? 'var(--green)' : 'var(--red)');
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="micro" style={{ whiteSpace: 'nowrap' }}>{label}</span>
        {delta != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 11, fontWeight: 600, color: dCol }}>
            <Ico d={up ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'} size={12} stroke={2.2} />{Math.abs(delta)}%
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

function DevGlyph({ d, size = 26 }) {
  const ICONS = {
    Agent: 'M12 2a5 5 0 0 1 5 5c0 1.5 2 2.5 2 5a7 7 0 0 1-14 0c0-2.5 2-3.5 2-5a5 5 0 0 1 5-5z',
    Device: 'M4 4h16v12H4zM2 20h20',
    'API token': 'M21 2l-2 2m-7.6 7.6a5 5 0 1 0 .8.8l4.6-4.6 2.4 2.4 2-2-2.4-2.4 2.4-2.4-2-2-4.6 4.6z',
    Automation: 'M13 2L3 14h7v8l10-12h-7z',
    Dashboard: 'M3 13h8V3H3zM13 21h8V8h-8zM13 3v3h8V3z',
  };
  return (
    <span style={{ width: size, height: size, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg-sunk)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
      <Ico d={ICONS[d.type] || ICONS.Device} size={size * 0.58} />
    </span>
  );
}

function Chip({ children }) {
  return <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink-2)', background: 'var(--bg-sunk)', border: '1px solid var(--line-2)', borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }}>{children}</span>;
}

// Map a service-breakdown array onto themed HBar items.
const toBars = (services) => services.map((s) => {
  const m = svcMeta(s.key);
  return { label: m.label, value: s.value, chip: m.chip, glyph: m.glyph, color: m.color };
});

// ── detail panel (right of donut) — reflects the current selection ────────
function DetailPanel({ device, aggregate, onClear, navigate }) {
  if (!device) {
    const { serviceTotals, busiest, grand } = aggregate;
    const topSvc = serviceTotals[0];
    return (
      <Panel title="Across all devices" hint="What your fleet is calling, in aggregate">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '11px 13px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{busiest ? busiest.label : '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Busiest client · {busiest && grand ? Math.round((busiest.value / grand) * 100) : 0}% of calls</div>
          </div>
          <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '11px 13px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{topSvc ? svcMeta(topSvc.key).label : '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Top service · {topSvc ? fmtN(topSvc.value) : 0} calls</div>
          </div>
        </div>
        <div className="micro" style={{ marginBottom: 11 }}>Calls by service</div>
        <HBars items={toBars(serviceTotals)} />
        <p style={{ fontSize: 11.5, color: 'var(--ink-4)', margin: '16px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ico d="M12 8v5M12 16h.01M12 3l9 16H3z" size={13} stroke={1.8} />Click any slice to see what a single device is calling.
        </p>
      </Panel>
    );
  }
  const st = STATUS[device.status];
  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><DevGlyph d={device} size={24} />{device.label}</span>}
      hint={`${device.type} client`}
      right={<button className="btn btn-ghost text-[12px]" onClick={onClear} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ico d="M15 18l-6-6 6-6" size={13} />All</button>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Badge tone={st.tone} dot live={st.live}>{st.label}</Badge>
        <Badge tone="neutral">{device.type}</Badge>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)', marginLeft: 'auto', fontFamily: MONO }}>{device.lastSeen}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Calls', value: fmtN(device.value), col: 'var(--ink)' },
          { label: 'Error rate', value: device.errPct + '%', col: device.errPct >= 2 ? 'var(--red)' : 'var(--ink)' },
          { label: 'Rate-limited', value: device.limited, col: device.limited >= 20 ? 'var(--amber)' : 'var(--ink)' },
        ].map((m) => (
          <div key={m.label} style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.col, lineHeight: 1.1, fontFamily: MONO }}>{m.value}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 }}>{m.label}</div>
          </div>
        ))}
      </div>
      <div className="micro" style={{ marginBottom: 11 }}>Calls by service</div>
      <HBars items={toBars(device.services)} />
      {device.scopes.length > 0 && (<>
        <div className="micro" style={{ margin: '18px 0 9px' }}>Scopes in use</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {device.scopes.map((s) => <Chip key={s}>{s}</Chip>)}
        </div>
      </>)}
      <div style={{ display: 'flex', gap: 8, marginTop: 18, borderTop: '1px solid var(--line-2)', paddingTop: 16 }}>
        <button className="btn text-[12px]" onClick={() => navigate('/activity')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Ico d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0zM12 7v5l3 2" size={13} />Audit log
        </button>
        <button className="btn text-[12px]" onClick={() => navigate('/device-management')} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Ico d="M9 5l7 7-7 7" size={12} />Manage
        </button>
      </div>
    </Panel>
  );
}

function InsightCard({ ins, onOpen, onDismiss }) {
  const tones = { warning: 'var(--amber)', danger: 'var(--red)', neutral: 'var(--ink-3)', accent: 'var(--accent)' };
  const bgs = { warning: 'var(--amber-bg)', danger: 'var(--red-bg)', neutral: 'var(--bg-sunk)', accent: 'var(--accent-bg)' };
  const c = tones[ins.tone];
  return (
    <div className="card" style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center', background: bgs[ins.tone], color: c }}>
          <Ico d={ins.icon} size={15} stroke={1.8} />
        </span>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, paddingTop: 2 }}>{ins.title}</div>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45 }}>{ins.body}</p>
      <button onClick={() => (ins.notifId ? onDismiss(ins.notifId) : onOpen(ins.dev))}
        style={{ alignSelf: 'flex-start', marginTop: 2, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {ins.cta}<Ico d="M5 12h14M13 6l6 6-6 6" size={13} />
      </button>
    </div>
  );
}

function DeviceRow({ d, color, selected, onSelect }) {
  const [hover, setHover] = useState(false);
  const st = STATUS[d.status];
  const top = d.services[0];
  const topMeta = top ? svcMeta(top.key) : null;
  return (
    <div onClick={() => onSelect(selected ? null : d.id)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="dash-trow"
      style={{ alignItems: 'center', padding: '11px 18px', cursor: 'pointer',
        borderBottom: '1px solid var(--line-2)', borderLeft: `2px solid ${selected ? color : 'transparent'}`,
        background: selected ? 'var(--bg-hover)' : hover ? 'var(--bg-sunk)' : 'transparent', transition: 'background .1s' }}>
      <div className="dc-device" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <DevGlyph d={d} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: MONO }}>{d.type} · {d.lastSeen}</div>
        </div>
      </div>
      <div className="dc-status"><Badge tone={st.tone} dot live={st.live}>{st.label}</Badge></div>
      <div className="dc-calls" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--ink)', width: 52, flexShrink: 0 }}>{fmtN(d.value)}</span>
        <div style={{ flex: 1, minWidth: 40, maxWidth: 120 }}><Sparkline data={d.daily} color={color} w={120} h={26} /></div>
      </div>
      <div className="dc-service" style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        {topMeta && <span style={{ width: 8, height: 8, borderRadius: 2, background: topMeta.color, flexShrink: 0 }} />}
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topMeta ? topMeta.label : '—'}</span>
      </div>
      <span className="dc-errors" style={{ fontFamily: MONO, fontSize: 12.5, color: d.errPct >= 2 ? 'var(--red)' : 'var(--ink-2)', textAlign: 'right' }}>{d.errPct}%</span>
      <span className="dc-chev" style={{ color: selected ? 'var(--accent)' : 'var(--ink-4)', display: 'grid', placeItems: 'center', justifySelf: 'end' }}>
        <Ico d={selected ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} size={15} />
      </span>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const navigate = useNavigate();
  const masterToken = useAuthStore((s) => s.masterToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);

  const [range, setRange] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selId, setSelId] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);

  // WebSocket-driven live alerts (device approvals, rate-limit warnings).
  const [alerts, setAlerts] = useState([]);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const fetchActivity = async (r = range) => {
    if (!isAuthenticated) return;
    try {
      const res = await apiClient.get(`/dashboard/device-activity?range=${r}`);
      setData(res.data?.data || res.data);
      setError(null);
    } catch (err) {
      if (err?.code === 'MYAPI_LOGOUT_IN_PROGRESS' || err?.code === 'MYAPI_RATE_LIMIT_BACKOFF') return;
      if (err.response?.status === 401 || err.response?.status === 403) { setLoading(false); return; }
      console.error('Failed to load device activity:', err);
      setError('Failed to load device activity');
    } finally {
      setLoading(false);
    }
  };

  const fetchBroadcasts = async () => {
    try {
      const res = await apiClient.get('/notifications?type=admin_attention_broadcast&read=false&limit=3');
      const list = res.data?.notifications || res.data?.data || [];
      setBroadcasts(Array.isArray(list) ? list : []);
    } catch { /* non-critical */ }
  };

  const dismissBroadcast = async (notifId) => {
    setBroadcasts((prev) => prev.filter((c) => c.id !== notifId));
    try { await apiClient.post(`/notifications/${notifId}/read`); } catch { /* ignore */ }
  };

  // Handle OAuth redirect params landing on the dashboard root — forward to
  // the destination page so it can show the connect-success state.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth_status');
    const oauthService = params.get('oauth_service');
    if (oauthStatus === 'pending_2fa') {
      const stored = sessionStorage.getItem('pendingOAuthParams');
      if (stored) { sessionStorage.removeItem('pendingOAuthParams'); navigate(`/authorize?${stored}`, { replace: true }); }
      window.history.replaceState({}, document.title, '/dashboard/');
      return;
    }
    if (oauthStatus && oauthService) {
      const rawNext = params.get('next');
      let targetPath = '/services';
      if (rawNext) targetPath = decodeURIComponent(rawNext).replace(/^\/dashboard/, '') || '/services';
      const fwd = new URLSearchParams();
      fwd.set('oauth_status', oauthStatus);
      fwd.set('oauth_service', oauthService);
      if (params.get('mode')) fwd.set('mode', params.get('mode'));
      if (params.get('error')) fwd.set('error', params.get('error'));
      navigate(`${targetPath}?${fwd.toString()}`, { replace: true });
    }
  }, [navigate]);

  const setupWebSocket = () => {
    const wsEnabled = typeof window !== 'undefined' && window.__MYAPI_WS_ENABLED === true;
    if (!wsEnabled || wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws`);
      ws.onopen = () => { if (masterToken) ws.send(JSON.stringify({ type: 'auth', token: masterToken })); };
      ws.onmessage = (event) => {
        try {
          const d = JSON.parse(event.data);
          if (d.type === 'device:pending_approval') {
            setAlerts((p) => [{ id: `alert-${Date.now()}`, severity: 'critical', title: 'New Device Requesting Access', message: `${d.deviceName} is requesting access from ${d.ip}`, details: `User Agent: ${d.userAgent}`, deviceId: d.deviceId, timestamp: new Date() }, ...p]);
            fetchActivity();
          } else if (d.type === 'rate_limit:warning') {
            setAlerts((p) => [{ id: `alert-${Date.now()}`, severity: 'warning', title: 'Rate Limit Warning', message: `You're approaching rate limits: ${d.message}`, timestamp: new Date() }, ...p]);
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { reconnectRef.current = setTimeout(setupWebSocket, 3000); };
      wsRef.current = ws;
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    setLoading(true);
    fetchActivity(range);
    fetchBroadcasts();
    setupWebSocket();
    const iv = setInterval(() => { fetchActivity(range); fetchBroadcasts(); }, 30000);
    return () => {
      clearInterval(iv);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterToken, isAuthenticated, currentWorkspace?.id, range]);

  const handleApproveDevice = async (deviceId) => {
    try {
      const headers = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
      await apiClient.post(`/devices/approve/${deviceId}`, { device_name: 'Approved Device' }, { headers });
      fetchActivity();
      navigate('/device-management');
    } catch (err) { console.error('Failed to approve device:', err); }
  };

  // ── derive view models from real data ──────────────────────────────────
  const devices = (data?.devices || []).map((d, i) => ({
    ...d,
    color: DEV_COLORS[i % DEV_COLORS.length],
    key: d.id,
    children: d.services.map((s) => ({ key: s.key, label: svcMeta(s.key).label, value: s.value, color: svcMeta(s.key).color })),
  }));
  const groups = devices.filter((d) => d.value > 0);
  const selected = devices.find((d) => d.id === selId) || null;
  const labels = data?.bucketLabels || [];
  const trend = selected ? selected.daily : (data?.allDaily || []);
  const trendColor = selected ? selected.color : 'var(--accent)';
  const serviceTotals = data?.serviceTotals || [];

  const aggregate = {
    serviceTotals,
    busiest: groups[0] ? { label: groups[0].label, value: groups[0].value } : null,
    grand: data?.grand || 0,
  };

  // Insights & alerts — admin broadcasts first, then anomalies derived from
  // the real device data (rate-limits, error spikes, idle clients).
  const insights = [];
  broadcasts.forEach((n) => insights.push({
    tone: 'accent', icon: 'M22 8.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7M16 11l5-3v8l-5-3z',
    title: n.title, body: n.message, notifId: n.id, cta: 'Dismiss',
  }));
  const mostLimited = [...devices].filter((d) => d.limited > 0).sort((a, b) => b.limited - a.limited)[0];
  if (mostLimited) insights.push({
    tone: 'danger', icon: 'M12 8v5M12 16h.01M12 3l9 16H3z',
    title: `${mostLimited.label} rate-limited ${mostLimited.limited}×`,
    body: `Hit ${mostLimited.limited} rate-limit response${mostLimited.limited > 1 ? 's' : ''} in this window. Consider backing off the schedule.`,
    dev: mostLimited.id, cta: 'Open device',
  });
  const worstErr = [...devices].filter((d) => d.errPct >= 2 && d.value > 5).sort((a, b) => b.errPct - a.errPct)[0];
  if (worstErr && worstErr.id !== mostLimited?.id) insights.push({
    tone: 'warning', icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
    title: `${worstErr.label}: ${worstErr.errPct}% error rate`,
    body: `Elevated error responses — the outlier across your clients. Confirm it's expected.`,
    dev: worstErr.id, cta: 'Inspect',
  });
  const idle = [...devices].filter((d) => d.status !== 'active' && d.value > 0).sort((a, b) => b.value - a.value)[0];
  if (idle && insights.length < 3) insights.push({
    tone: 'neutral', icon: 'M12 7v5l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z',
    title: `${idle.label} ${idle.status === 'paused' ? 'dormant' : 'idle'} — last seen ${idle.lastSeen}`,
    body: 'No recent activity. Revoke its token to shrink your exposure if it is no longer in use.',
    dev: idle.id, cta: 'Review',
  });
  const displayInsights = insights.slice(0, 3);

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="inline-block"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--accent)]" /></div>
          <p className="mt-4 ink-3 text-[13px] mono">loading device activity…</p>
        </div>
      </div>
    );
  }

  const grand = data?.grand || 0;
  const deviceCount = data?.deviceCount || 0;
  const rangeLabel = { '24h': '24h', '7d': '7d', '30d': '30d' }[range];
  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toLowerCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-tour="dashboard">
      <AlertBanner alerts={alerts} onDismiss={(id) => setAlerts((p) => p.filter((a) => a.id !== id))} onApprove={handleApproveDevice} />
      <PendingInvitations />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">CONTROL ROOM · {dayLabel}</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">
            Everything passing through <span className="accent" style={{ fontStyle: 'italic' }}>MyApi</span>.
          </h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">One gateway between your services and the agents that use them.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge tone="success" dot live>Live</Badge>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Your devices &amp; agents — what each is calling on your behalf</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 8 }}>
            {['24h', '7d', '30d'].map((r) => (
              <button key={r} onClick={() => { setSelId(null); setRange(r); }}
                style={{ padding: '4px 12px', fontSize: 12.5, fontWeight: 500, borderRadius: 6, cursor: 'pointer', border: '1px solid transparent',
                  background: range === r ? 'var(--bg-raised)' : 'transparent', color: range === r ? 'var(--ink)' : 'var(--ink-3)', boxShadow: range === r ? '0 1px 2px rgba(0,0,0,0.35)' : 'none' }}>{r}</button>
            ))}
          </div>
          <button className="btn text-[12px]" onClick={() => navigate('/activity')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Ico d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" size={14} />Activity log
          </button>
        </div>
      </div>

      {error && <div className="card p-4" style={{ borderColor: 'rgba(248,81,73,0.4)' }}><p className="text-[13px]" style={{ color: 'var(--red)' }}>{error}</p></div>}

      {/* KPI row */}
      <div data-tour="dash-kpis" className="dash-kpis">
        <Kpi label={`API CALLS · ${rangeLabel}`} value={fmtN(grand)} sub={`across ${deviceCount} device${deviceCount === 1 ? '' : 's'}`} spark={data?.allDaily || []} />
        <Kpi label="ACTIVE DEVICES" value={`${data?.activeCount || 0} / ${deviceCount}`} sub={`${Math.max(0, deviceCount - (data?.activeCount || 0))} idle or dormant`} spark={devices.map((d) => (d.status === 'active' ? 1 : 0))} color="var(--green)" />
        <Kpi label="ERROR RATE" value={(data?.errorRate || 0) + '%'} sub={worstErr ? `${worstErr.label} is the outlier` : 'across all clients'} tone="inverse" spark={data?.allDaily || []} color="var(--amber)" />
        <Kpi label={`RATE-LIMITED · ${rangeLabel}`} value={fmtFull(data?.rateLimited || 0)} sub={mostLimited ? `mostly ${mostLimited.label}` : 'no rate-limit hits'} tone="inverse" spark={data?.allDaily || []} color="var(--red)" />
      </div>

      {/* Hero: drill-down donut + linked detail */}
      <div data-tour="dash-donut" className="dash-hero">
        <Panel title="API calls by device" hint={selected ? `${selected.label} · calls by service — click center to go back` : 'Click a slice to drill into one device’s calls'}>
          <DrillDonut groups={groups} selectedKey={selId} onSelect={setSelId} fmt={fmtN} />
        </Panel>
        <DetailPanel device={selected} aggregate={aggregate} onClear={() => setSelId(null)} navigate={navigate} />
      </div>

      {/* Insights & alerts */}
      <div data-tour="dash-insights">
        <div className="micro" style={{ marginBottom: 9 }}>Insights &amp; alerts</div>
        {displayInsights.length > 0 ? (
          <div className="dash-insights" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, displayInsights.length)}, 1fr)`, gap: 12 }}>
            {displayInsights.map((ins, i) => <InsightCard key={ins.notifId || i} ins={ins} onOpen={setSelId} onDismiss={dismissBroadcast} />)}
          </div>
        ) : (
          <div className="card" style={{ padding: 16, fontSize: 12.5, color: 'var(--ink-4)' }}>No anomalies or announcements right now. All clients are within normal ranges.</div>
        )}
      </div>

      {/* Trend — follows selection */}
      <Panel title={selected ? `${selected.label} — calls over time` : 'Total calls over time'}
        hint={`Per ${range === '24h' ? 'hour' : 'day'} · last ${rangeLabel}${selected ? '' : ' · all devices'}`}
        right={selected
          ? <button className="btn btn-ghost text-[12px]" onClick={() => setSelId(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ico d="M15 18l-6-6 6-6" size={13} />All devices</button>
          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-3)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} />All devices</span>}>
        <BarChart data={trend} labels={labels} color={trendColor} fmt={fmtFull} height={150} />
      </Panel>

      {/* Device table */}
      <div data-tour="dash-table">
      <Panel title="Devices &amp; agents" hint="Every client holding a scoped token — select one to focus the dashboard" pad={0}>
        <div className="dash-thead" style={{ padding: '9px 18px', borderBottom: '1px solid var(--line-2)' }}>
          <span className="micro">Device</span>
          <span className="micro">Status</span>
          <span className="micro">Calls · {rangeLabel}</span>
          <span className="micro">Top service</span>
          <span className="micro" style={{ textAlign: 'right' }}>Errors</span>
          <span />
        </div>
        {devices.length > 0 ? devices.map((d) => (
          <DeviceRow key={d.id} d={d} color={d.color} selected={selId === d.id} onSelect={setSelId} />
        )) : (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No device or agent API calls in the last {rangeLabel}. Issue a scoped token to connect a client.
          </div>
        )}
      </Panel>
      </div>

      <p style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: MONO, margin: '4px 0 0' }}>
        Aggregated from your audit log · scoped tokens only · dashboard browsing is never counted
      </p>
    </div>
  );
}

export default Dashboard;
