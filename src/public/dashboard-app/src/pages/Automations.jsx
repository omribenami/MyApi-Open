import React, { useState, useEffect, useCallback } from 'react';
import { automations, services as servicesApi } from '../utils/apiClient';

// MyApi Automations — GitHub-Primer design (WHEN · WHO · WHAT). Visuals follow
// the MyApi Design System; all backend wiring (multi-provider AI, credit wallet,
// edit, test) is preserved.

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Token fallbacks for the few design vars not in the app's index.css.
const R = '6px';                                   // --radius-md
const RING = '0 0 0 3px var(--accent-bg)';         // --focus-ring

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseTime = (t) => { const [h, m] = String(t || '09:00').split(':'); return { atHour: +h || 0, atMinute: +m || 0 }; };
const fmtTime = (t) => { const [h, m] = String(t).split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; const hh = ((h + 11) % 12) + 1; return `${hh}:${pad(m)} ${ap}`; };
const fmtDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const SUGGESTIONS = {
  gmail: ['Summarize my unread emails and notify me', 'Flag urgent emails and tell me about them', 'Draft replies to emails that need a response'],
  google: ['Summarize my unread emails and notify me', "Remind me of today's calendar events", 'List files recently shared with me'],
  googlecalendar: ["Summarize today's meetings each morning", "Remind me tonight about tomorrow's first meeting", 'Warn me about scheduling conflicts this week'],
  googledrive: ['List files shared with me today', 'Summarize documents modified since yesterday', "Remind me of files I haven't opened in a while"],
  slack: ['Summarize unread messages in my channels', 'Alert me to messages that mention me', 'Recap what I missed overnight'],
  github: ['Summarize new issues and pull requests', 'Tell me which PRs are waiting on my review', 'List failing checks on my open PRs'],
  notion: ['Summarize pages updated since yesterday', 'Remind me of tasks due today', 'Digest new entries in my database'],
  linear: ['Summarize issues assigned to me', "Tell me what changed on my team's board", 'Remind me of issues due this week'],
  hubspot: ['Summarize new leads from today', 'Remind me of deals closing this week', "List contacts I haven't followed up with"],
};
const GENERIC_SUGGESTIONS = ["Give me a daily summary of what's new", 'Notify me about anything important', 'Create a short digest and send it to me'];
const suggestionsFor = (id) => SUGGESTIONS[String(id || '').toLowerCase()] || GENERIC_SUGGESTIONS;

// ── Design-system primitives (inline, token-driven) ───────────────────────────
function Btn({ variant = 'secondary', size = 'md', disabled, iconLeft, onClick, children, style = {}, ...rest }) {
  const V = {
    primary: { background: 'var(--accent-2)', color: '#fff', border: '1px solid rgba(240,246,252,0.1)' },
    secondary: { background: 'var(--bg-raised)', color: 'var(--ink)', border: '1px solid var(--line)' },
    ghost: { background: 'transparent', color: 'var(--ink-2)', border: '1px solid transparent' },
  }[variant] || {};
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      onMouseEnter={(e) => { if (disabled) return; if (variant === 'primary') e.currentTarget.style.filter = 'brightness(1.1)'; else e.currentTarget.style.background = variant === 'ghost' ? 'var(--bg-sunk)' : 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.background = V.background; }}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: size === 'sm' ? '4px 10px' : '6px 13px', fontSize: size === 'sm' ? '12.5px' : '13px', fontWeight: 500, borderRadius: R, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', transition: 'background .1s, filter .1s, border-color .1s', ...V, ...style }} {...rest}>
      {iconLeft}{children}
    </button>
  );
}

function Card({ padding = 20, muted, style = {}, children, ...rest }) {
  return <div style={{ background: muted ? 'var(--bg-sunk)' : 'var(--bg-raised)', border: `1px solid ${muted ? 'var(--line-2)' : 'var(--line)'}`, borderRadius: R, padding: typeof padding === 'number' ? `${padding}px` : padding, ...style }} {...rest}>{children}</div>;
}

function Field({ label, hint, as = 'input', value, onChange, placeholder, type = 'text', rows = 3, children, style = {}, ...rest }) {
  const [focus, setFocus] = useState(false);
  const control = { display: 'block', width: '100%', boxSizing: 'border-box', background: 'var(--bg-sunk)', color: 'var(--ink)', border: `1px solid ${focus ? 'var(--accent)' : 'var(--line)'}`, boxShadow: focus ? RING : 'none', borderRadius: R, padding: '7px 12px', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', transition: 'border-color .1s, box-shadow .1s' };
  const common = { value, onChange, placeholder, onFocus: () => setFocus(true), onBlur: () => setFocus(false), style: control, ...rest };
  return (
    <label style={{ display: 'block', ...style }}>
      {label && <span style={{ display: 'block', fontSize: '13px', color: 'var(--ink-2)', marginBottom: '6px' }}>{label}</span>}
      {as === 'textarea' ? <textarea rows={rows} {...common} /> : as === 'select' ? <select {...common}>{children}</select> : <input type={type} {...common} />}
      {hint && <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--ink-3)', marginTop: '6px' }}>{hint}</span>}
    </label>
  );
}

function Badge({ tone = 'neutral', dot, live, children }) {
  const T = {
    neutral: { c: 'var(--ink-2)', b: 'var(--line)', bg: 'var(--bg-raised)' },
    success: { c: 'var(--green)', b: 'var(--green)', bg: 'var(--green-bg)' },
    warning: { c: 'var(--amber)', b: 'var(--amber)', bg: 'var(--amber-bg)' },
  }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: `1px solid ${T.b}`, background: T.bg, color: T.c, borderRadius: '999px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>
      {dot && <span className={live ? 'live-dot' : ''} style={{ width: '6px', height: '6px', borderRadius: '999px', background: T.c, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

function StepNav({ steps, current, onStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {steps.map((s, i) => {
        const state = i === current ? 'active' : i < current ? 'done' : 'todo';
        const ring = {
          active: { background: 'var(--accent-2)', color: '#fff', border: '1px solid transparent' },
          done: { background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)' },
          todo: { background: 'var(--bg-sunk)', color: 'var(--ink-3)', border: '1px solid var(--line)' },
        }[state];
        return (
          <React.Fragment key={s.label}>
            <button type="button" onClick={() => onStep && onStep(i)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', padding: '4px 2px', cursor: onStep ? 'pointer' : 'default', textAlign: 'left' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '999px', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 600, ...ring }}>{state === 'done' ? '✓' : i + 1}</span>
              <span style={{ lineHeight: 1.2 }}>
                <span className="micro" style={{ display: 'block', color: state === 'active' ? 'var(--accent)' : 'var(--ink-3)' }}>{s.kicker}</span>
                <span style={{ fontSize: '13.5px', fontWeight: 500, color: state === 'todo' ? 'var(--ink-3)' : 'var(--ink)' }}>{s.label}</span>
              </span>
            </button>
            {i < steps.length - 1 && <span style={{ flex: 1, height: '1px', minWidth: '12px', background: i < current ? 'var(--green)' : 'var(--line)' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function OptionCard({ selected, disabled, icon, title, subtitle, onClick, align = 'center' }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" disabled={disabled} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', flexDirection: align === 'center' ? 'column' : 'row', justifyContent: align === 'center' ? 'center' : 'flex-start', textAlign: align === 'center' ? 'center' : 'left', gap: align === 'center' ? '6px' : '12px', width: '100%', minHeight: '44px', padding: '12px 14px', borderRadius: R, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, background: selected ? 'var(--accent-bg)' : hover && !disabled ? 'var(--bg-hover)' : 'var(--bg-sunk)', border: `1px solid ${selected ? 'var(--accent)' : 'var(--line)'}`, transition: 'background .1s, border-color .1s' }}>
      {icon && <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center', color: selected ? 'var(--accent)' : 'var(--ink-3)' }}>{icon}</span>}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 500, color: 'var(--ink)' }}>{title}</span>
        {subtitle && <span style={{ display: 'block', fontSize: '12px', color: selected ? 'var(--accent)' : 'var(--ink-3)', marginTop: '1px' }}>{subtitle}</span>}
      </span>
      {selected && align !== 'center' && <span style={{ marginLeft: 'auto', flexShrink: 0, width: '18px', height: '18px', borderRadius: '999px', background: 'var(--accent-2)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '11px' }}>✓</span>}
    </button>
  );
}

function ServiceTile({ service, selected, onClick }) {
  const [hover, setHover] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const name = service.name || service.id;
  const url = service.icon && /^https?:/.test(service.icon) ? service.icon : null;
  const letter = (name || '?').trim()[0].toUpperCase();
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minHeight: '44px', padding: '8px 10px', textAlign: 'left', borderRadius: R, cursor: 'pointer', background: selected ? 'var(--accent-bg)' : hover ? 'var(--bg-hover)' : 'var(--bg-sunk)', border: `1px solid ${selected ? 'var(--accent)' : 'var(--line)'}`, transition: 'background .1s, border-color .1s' }}>
      {url && imgOk
        ? <img src={url} onError={() => setImgOk(false)} width={28} height={28} style={{ borderRadius: '8px', flexShrink: 0, background: '#fff', padding: '2px', objectFit: 'contain' }} alt="" />
        : <span style={{ width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, background: 'var(--accent-2)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 700 }}>{letter}</span>}
      <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {selected && <span style={{ flexShrink: 0, width: '18px', height: '18px', borderRadius: '999px', background: 'var(--accent-2)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '11px' }}>✓</span>}
    </button>
  );
}

const GearIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
const BoltIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg>;

// ── Schedule helpers ───────────────────────────────────────────────────────────
function defaultModelFor(providers, provider) { return providers?.[provider]?.defaultModel || ''; }
function pickDefaultEngine(providers) {
  const entries = Object.entries(providers || {});
  const withModel = (kind, provider) => ({ kind, provider, model: defaultModelFor(providers, provider) });
  const byo = entries.find(([, p]) => p.byo?.configured);
  if (byo) return withModel('byo', byo[0]);
  const plat = entries.find(([, p]) => p.platformAvailable);
  if (plat) return withModel('myapi', plat[0]);
  return withModel('myapi', entries[0]?.[0] || 'anthropic');
}

function deriveInit(editing, connected, providers) {
  const base = { date: ymd(new Date(Date.now() + 86400000)), time: '09:00', repeat: 'daily', weekday: 1, monthday: 1, services: [], prompt: '', name: '', engine: pickDefaultEngine(providers) };
  if (!editing) return base;
  const a = editing.action || {};
  const s = editing.schedule || {};
  const tt = (h, m) => `${pad(h || 0)}:${pad(m || 0)}`;
  let { repeat, date, time, weekday, monthday } = base;
  if (s.type === 'once' && s.at) { const d = new Date(s.at); repeat = 'once'; date = ymd(d); time = tt(d.getHours(), d.getMinutes()); }
  else if (s.type === 'daily') { repeat = 'daily'; time = tt(s.atHour, s.atMinute); }
  else if (s.type === 'weekly') { repeat = 'weekly'; time = tt(s.atHour, s.atMinute); weekday = s.weekday ?? 1; }
  else if (s.type === 'monthly') { repeat = 'monthly'; time = tt(s.atHour, s.atMinute); monthday = s.day || 1; }
  const ids = a.services?.length ? a.services : (a.service ? [a.service] : []);
  const services = ids.map((id) => { const c = connected.find((x) => (x.id || x.name) === id); return c ? { id: c.id || c.name, name: c.name || c.id, icon: c.icon } : { id, name: id }; });
  const provider = a.provider || pickDefaultEngine(providers).provider;
  const engine = { kind: a.keyMode === 'byo' ? 'byo' : 'myapi', provider, model: a.model || defaultModelFor(providers, provider) };
  return { date, time, repeat, weekday, monthday, services, prompt: a.prompt || a.instruction || '', name: editing.name || '', engine };
}

// ── Page ────────────────────────────────────────────────────────────────────────
export default function Automations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [building, setBuilding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [ai, setAi] = useState({ providers: {}, defaultProvider: 'anthropic' });
  const [connected, setConnected] = useState([]);
  const [runResults, setRunResults] = useState({});
  const [busyId, setBusyId] = useState(null);

  const flash = (msg, isErr = false) => { setToast({ msg, isErr }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await automations.list(); setItems(res.data?.data || []); setError(null); }
    catch (e) { setError(e.response?.data?.error || 'Failed to load automations'); }
    finally { setLoading(false); }
  }, []);

  const loadAi = useCallback(() => {
    automations.aiSettings().then((r) => setAi({ providers: r.data?.providers || {}, defaultProvider: r.data?.defaultProvider || 'anthropic', myapiAi: r.data?.myapiAi || null, plan: r.data?.plan })).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    loadAi();
    servicesApi.getConnected()
      .then((r) => {
        const all = r.data?.data || r.data?.services || [];
        setConnected(all.filter((s) => s.status === 'connected' && String(s.id || s.name).toLowerCase() !== 'afp'));
      })
      .catch(() => {});
  }, [load, loadAi]);

  const toggle = async (t) => {
    try { await automations.update(t.id, { enabled: !t.enabled }); setItems((xs) => xs.map((x) => x.id === t.id ? { ...x, enabled: !t.enabled } : x)); }
    catch { flash('Could not update', true); }
  };
  const remove = async (t) => {
    if (!window.confirm(`Delete automation "${t.name}"?`)) return;
    try { await automations.remove(t.id); setItems((xs) => xs.filter((x) => x.id !== t.id)); flash('Deleted'); }
    catch { flash('Could not delete', true); }
  };
  const test = async (t) => {
    setBusyId(t.id);
    try {
      const r = await automations.run(t.id);
      setRunResults((m) => ({ ...m, [t.id]: r.data }));
      flash(r.data?.ok ? 'Test run succeeded' : 'Test run finished with an error', !r.data?.ok);
      load();
    } catch (e) {
      setRunResults((m) => ({ ...m, [t.id]: e.response?.data || { ok: false, error: 'Run failed' } }));
      flash('Test run failed', true);
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div className="micro mb-2">OVERVIEW · AUTOMATIONS</div>
          <h1 className="font-serif text-[20px] sm:text-[28px] font-medium tracking-tight ink" style={{ margin: 0 }}>Work that runs without you.</h1>
          <p className="mt-2 text-[15px] ink-2" style={{ maxWidth: '60ch', lineHeight: 1.5 }}>
            Tell your AI assistant to do something on a schedule — it runs for you automatically, even when you're offline.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn variant="secondary" data-tour="auto-settings" iconLeft={<GearIcon />} onClick={() => setShowSettings(true)}>Settings</Btn>
          {!building && !editing && <Btn variant="primary" data-tour="auto-new" iconLeft={<BoltIcon />} onClick={() => setBuilding(true)}>New automation</Btn>}
        </div>
      </div>

      {(building || editing) && (
        <Wizard key={editing?.id || 'new'} ai={ai} connected={connected} editing={editing}
          onCancel={() => { setBuilding(false); setEditing(null); }}
          onSaved={() => { const wasEdit = !!editing; setBuilding(false); setEditing(null); load(); flash(wasEdit ? 'Automation saved' : 'Automation created'); }}
          onError={(m) => flash(m, true)}
          onOpenSettings={() => setShowSettings(true)} />
      )}

      {loading ? (
        <div style={{ color: 'var(--ink-3)', fontSize: '13.5px' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: 'var(--red)', fontSize: '13.5px' }}>{error}</div>
      ) : items.length === 0 && !building ? (
        <Card padding={48} style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--ink)', fontWeight: 500 }}>No automations yet</p>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-3)', fontSize: '13px' }}>Create your first — e.g. “Every morning, summarize my unread email.”</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((t) => (
            <Card key={t.id} padding={16}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{t.name}</h3>
                    {t.enabled ? <Badge tone="success" dot live>Active</Badge> : <Badge tone="neutral">Paused</Badge>}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--ink-2)' }}>
                    <span style={{ color: 'var(--accent)' }}>{t.scheduleLabel || '—'}</span>
                    <span style={{ color: 'var(--ink-3)' }}> · {actionSummary(t)}</span>
                  </p>
                  {t.nextRunAt && t.enabled && <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'var(--ink-3)' }}>Next run: {new Date(t.nextRunAt).toLocaleString()}</p>}
                  {runResults[t.id] && <RunResult result={runResults[t.id]} />}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <Btn size="sm" variant="secondary" onClick={() => test(t)} disabled={busyId === t.id}>{busyId === t.id ? 'Running…' : 'Test now'}</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => { setEditing(t); setBuilding(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => toggle(t)}>{t.enabled ? 'Pause' : 'Resume'}</Btn>
                  <Btn size="sm" variant="ghost" style={{ color: 'var(--red)' }} onClick={() => remove(t)}>Delete</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showSettings && <SettingsModal ai={ai} onClose={() => setShowSettings(false)} onChanged={loadAi} flash={flash} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 60, background: 'var(--bg-raised)', border: `1px solid ${toast.isErr ? 'var(--red)' : 'var(--green)'}`, color: 'var(--ink)', padding: '10px 14px', borderRadius: R, fontSize: '13px', boxShadow: '0 8px 24px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="tick" style={{ background: toast.isErr ? 'var(--red)' : 'var(--green)' }} />{toast.msg}
        </div>
      )}
    </div>
  );
}

function actionSummary(t) {
  const a = t.action || {};
  if (t.actionType === 'ai_prompt') {
    const p = (a.prompt || '').slice(0, 56);
    const svcs = a.services?.length ? a.services.join(' + ') : a.service;
    return `${svcs ? `${svcs} · ` : ''}“${p}${(a.prompt || '').length > 56 ? '…' : ''}”`;
  }
  if (t.actionType === 'service_proxy') return `call ${a.service || 'a service'}`;
  if (t.actionType === 'afp_exec') return `run a command on ${a.deviceId}`;
  return t.actionType;
}

function RunResult({ result }) {
  const ok = result?.ok;
  const r = result?.result || result?.run?.result || {};
  const text = r?.data?.text || r?.text;
  return (
    <div style={{ marginTop: '8px', fontSize: '13px', borderRadius: R, padding: '10px 12px', background: ok ? 'var(--green-bg)' : 'var(--red-bg)', color: ok ? 'var(--green)' : 'var(--red)', border: `1px solid ${ok ? 'var(--green)' : 'var(--red)'}` }}>
      {ok ? (text || 'Ran successfully.') : (result?.result?.error || result?.error || 'Failed.')}
    </div>
  );
}

// ── Wizard (WHEN · WHO · WHAT) ────────────────────────────────────────────────
function Wizard({ ai, connected, editing, onCancel, onSaved, onError, onOpenSettings }) {
  const init = React.useMemo(() => deriveInit(editing, connected, ai.providers), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState(0); // 0=When 1=Who 2=What
  const [saving, setSaving] = useState(false);

  const [repeat, setRepeat] = useState(init.repeat);
  const [time, setTime] = useState(init.time);
  const [weekday, setWeekday] = useState(init.weekday);
  const [monthday, setMonthday] = useState(init.monthday);
  const [date, setDate] = useState(init.date);

  const [services, setServices] = useState(init.services);
  const toggleService = (s) => setServices((xs) => xs.some((x) => x.id === s.id) ? xs.filter((x) => x.id !== s.id) : [...xs, s]);
  const primary = services[0] || null;

  const [prompt, setPrompt] = useState(init.prompt);
  const [name, setName] = useState(init.name);
  const [engine, setEngine] = useState(init.engine);

  useEffect(() => { if (!editing) setEngine(pickDefaultEngine(ai.providers)); }, [ai.providers]); // eslint-disable-line react-hooks/exhaustive-deps

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  function buildSchedule() {
    const { atHour, atMinute } = parseTime(time);
    if (repeat === 'once') return { type: 'once', at: new Date(`${date}T${time}`).toISOString() };
    if (repeat === 'daily') return { type: 'daily', atHour, atMinute };
    if (repeat === 'weekly') return { type: 'weekly', weekday, atHour, atMinute };
    return { type: 'monthly', day: monthday, atHour, atMinute };
  }
  const whenText = () => {
    if (repeat === 'once') return `Once on ${fmtDate(date)} at ${fmtTime(time)}`;
    if (repeat === 'daily') return `Every day at ${fmtTime(time)}`;
    if (repeat === 'weekly') return `Every ${DOW_FULL[weekday]} at ${fmtTime(time)}`;
    return `Monthly on day ${monthday} at ${fmtTime(time)}`;
  };
  const whoText = () => services.length ? services.map((s) => s.name).join(' + ') : 'a general task';

  // engine availability (preserved logic). MyApi-provided AI also requires the
  // plan to allow it — free plans never get the MyApi token, only BYO keys.
  const myApiAllowed = !(ai.myapiAi && ai.myapiAi.allowed === false);
  const myApiProviders = myApiAllowed ? Object.entries(ai.providers).filter(([, p]) => p.platformAvailable).map(([id]) => id) : [];
  const byoProviders = Object.entries(ai.providers).filter(([, p]) => p.byo?.configured).map(([id]) => id);
  const engineAvailable = engine.kind === 'byo' ? byoProviders.includes(engine.provider) : myApiProviders.includes(engine.provider);
  const anyEngine = myApiProviders.length > 0 || byoProviders.length > 0;
  const setProviderKeep = (kind, provider) => { const model = provider === engine.provider ? engine.model : defaultModelFor(ai.providers, provider); setEngine({ kind, provider, model }); };
  const setEngineKind = (kind) => {
    if (kind === 'byo') setProviderKeep('byo', byoProviders.includes(engine.provider) ? engine.provider : byoProviders[0]);
    else setProviderKeep('myapi', myApiProviders.includes(engine.provider) ? engine.provider : myApiProviders[0]);
  };
  const engProviders = engine.kind === 'byo' ? byoProviders : myApiProviders;
  const modelOptions = ai.providers?.[engine.provider]?.models || [];

  const save = async () => {
    if (!prompt.trim()) return onError('Tell the assistant what to do');
    if (!engineAvailable) return onError('Choose an available AI engine (see Settings)');
    if (repeat === 'once' && new Date(`${date}T${time}`).getTime() <= Date.now()) return onError('Pick a future date and time for a one-time automation');
    const finalName = name.trim() || `${primary ? primary.name + ' — ' : ''}${prompt.trim().slice(0, 40)}`;
    const action = { prompt: prompt.trim(), services: services.length ? services.map((s) => s.id) : undefined, provider: engine.provider, model: engine.model || undefined, keyMode: engine.kind === 'byo' ? 'byo' : 'platform' };
    setSaving(true);
    try {
      if (editing) await automations.update(editing.id, { name: finalName, schedule: buildSchedule(), timezone, action });
      else await automations.create({ name: finalName, kind: 'schedule', schedule: buildSchedule(), timezone, actionType: 'ai_prompt', action });
      onSaved();
    } catch (e) { onError(e.response?.data?.error || `Could not ${editing ? 'save' : 'create'} automation`); }
    finally { setSaving(false); }
  };

  const H = ({ children, sub }) => (
    <div style={{ marginBottom: '18px' }}>
      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{children}</h3>
      {sub && <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
  const steps = [{ kicker: 'Step 1', label: 'When' }, { kicker: 'Step 2', label: 'Who' }, { kicker: 'Step 3', label: 'What' }];

  return (
    <Card padding={0} style={{ overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line-2)', background: 'var(--bg-sunk)' }}>
        {editing && <div className="micro" style={{ color: 'var(--accent)', marginBottom: '10px' }}>Editing “{editing.name}”</div>}
        <StepNav steps={steps} current={step} onStep={(i) => { if (i <= step || prompt || i < 2) setStep(i); }} />
      </div>

      <div style={{ padding: '24px 22px' }}>
        {/* STEP 1 — WHEN */}
        {step === 0 && (
          <div>
            <H sub="Pick how often the assistant should run this — and at what time.">When should this run?</H>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {[['once', 'Once'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month']].map(([id, label]) => (
                <OptionCard key={id} title={label} selected={repeat === id} onClick={() => setRepeat(id)} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ width: '150px' }}><Field label="At what time?" as="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              {repeat === 'once' && <div style={{ width: '180px' }}><Field label="On which day?" as="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>}
              {repeat === 'weekly' && (
                <div>
                  <span style={{ display: 'block', fontSize: '13px', color: 'var(--ink-2)', marginBottom: '6px' }}>On which day?</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {DOW.map((d, i) => (
                      <button key={i} onClick={() => setWeekday(i)} title={DOW_FULL[i]} style={{ width: '38px', height: '38px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, border: `1px solid ${weekday === i ? 'var(--accent)' : 'var(--line)'}`, background: weekday === i ? 'var(--accent-2)' : 'var(--bg-sunk)', color: weekday === i ? '#fff' : 'var(--ink-2)', fontFamily: 'inherit', transition: 'all .1s' }}>{d}</button>
                    ))}
                  </div>
                </div>
              )}
              {repeat === 'monthly' && (
                <div style={{ width: '120px' }}>
                  <Field label="Day of month" as="select" value={monthday} onChange={(e) => setMonthday(+e.target.value)}>
                    {Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 — WHO */}
        {step === 1 && (
          <div>
            <H sub="Choose the connected apps this automation may read from or act on. Pick several, or none for a general task.">Which apps can it use?</H>
            {connected.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px', maxHeight: '320px', overflowY: 'auto' }}>
                {connected.map((s) => {
                  const item = { id: s.id || s.name, name: s.name || s.id, icon: s.icon };
                  return <ServiceTile key={item.id} service={s} selected={services.some((x) => x.id === item.id)} onClick={() => toggleService(item)} />;
                })}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--ink-2)', marginBottom: '14px' }}>You have no connected services yet — create a general task, or <a href="/dashboard/services" style={{ color: 'var(--accent)' }}>connect a service</a> first.</p>
            )}
            <button onClick={() => setServices([])} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', cursor: 'pointer', borderRadius: R, border: `1px dashed ${services.length === 0 ? 'var(--accent)' : 'var(--line)'}`, background: services.length === 0 ? 'var(--accent-bg)' : 'transparent', color: 'var(--ink-2)', fontSize: '13px', fontFamily: 'inherit' }}>
              <span style={{ color: services.length === 0 ? 'var(--accent)' : 'var(--ink-3)', display: 'grid' }}><BoltIcon /></span>
              No apps — just a general task
            </button>
          </div>
        )}

        {/* STEP 3 — WHAT */}
        {step === 2 && (
          <div>
            <H sub={`Pick a suggestion or write your own.${services.length ? ` It can use ${whoText()}.` : ''}`}>What should it do?</H>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {suggestionsFor(primary?.id).map((s) => (
                <OptionCard key={s} align="start" title={s} selected={prompt === s} onClick={() => setPrompt(s)} />
              ))}
            </div>
            <Field as="textarea" rows={3} placeholder="…or describe your own task in plain English" value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ marginBottom: '12px' }} />
            <Field placeholder="Name this automation (optional)" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: '18px' }} />

            <span style={{ display: 'block', fontSize: '13px', color: 'var(--ink-2)', marginBottom: '8px' }}>Run it with</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <OptionCard align="start" title="My own API key" subtitle="Free · uses your key" disabled={!byoProviders.length} selected={engine.kind === 'byo'} onClick={() => byoProviders.length && setEngineKind('byo')} />
              <OptionCard align="start" title="MyApi AI assistant" subtitle={myApiAllowed ? 'Billed as credits' : 'Pro & Heavy plans'} disabled={!myApiProviders.length} selected={engine.kind === 'myapi'} onClick={() => myApiProviders.length && setEngineKind('myapi')} />
            </div>

            {(engProviders.length > 1 || modelOptions.length > 0) && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
                {engProviders.length > 1 && (
                  <div style={{ width: '180px' }}>
                    <Field label="Provider" as="select" value={engine.provider} onChange={(e) => setProviderKeep(engine.kind, e.target.value)}>
                      {engProviders.map((id) => <option key={id} value={id}>{ai.providers[id]?.label || id}</option>)}
                    </Field>
                  </div>
                )}
                {modelOptions.length > 0 && (
                  <div style={{ width: '220px' }}>
                    <Field label="Model" as="select" value={engine.model} onChange={(e) => setEngine((m) => ({ ...m, model: e.target.value }))}>
                      {modelOptions.map((mo) => <option key={mo.id} value={mo.id}>{mo.label}{mo.tier ? ` — ${mo.tier}` : ''}</option>)}
                    </Field>
                  </div>
                )}
              </div>
            )}
            {!anyEngine && (
              <p style={{ fontSize: '13px', color: 'var(--amber)', marginTop: '10px' }}>No AI engine is set up. <button onClick={onOpenSettings} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Open Settings</button> to add a key.</p>
            )}
          </div>
        )}
      </div>

      {/* Recipe + actions */}
      <div style={{ borderTop: '1px solid var(--line-2)', padding: '14px 22px', background: 'var(--bg-sunk)' }}>
        <div style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: '14px' }}>
          <span className="micro" style={{ marginRight: '8px' }}>Recipe</span>
          <span style={{ color: 'var(--accent)' }}>{whenText()}</span>
          <span style={{ color: 'var(--ink-3)' }}>, using </span>
          <span style={{ color: 'var(--ink)' }}>{whoText()}</span>
          <span style={{ color: 'var(--ink-3)' }}>, </span>
          <span style={{ color: 'var(--ink)' }}>{prompt ? `“${prompt.length > 60 ? prompt.slice(0, 60) + '…' : prompt}”` : '…'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <Btn variant="ghost" onClick={() => step === 0 ? onCancel() : setStep(step - 1)}>{step === 0 ? 'Cancel' : 'Back'}</Btn>
          {step < 2
            ? <Btn variant="primary" onClick={() => setStep(step + 1)}>Next</Btn>
            : <Btn variant="primary" disabled={saving || !prompt.trim() || !engineAvailable} onClick={save}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create automation'}</Btn>}
        </div>
      </div>
    </Card>
  );
}

// ── Settings modal (AI engine, keys, credit wallet) ───────────────────────────
function SettingsModal({ ai, onClose, onChanged, flash }) {
  const save = async (provider, key) => {
    try { await automations.setKey(provider, key.trim()); onChanged(); flash(`${ai.providers[provider]?.label || provider} key saved`); return true; }
    catch (e) { flash(e.response?.data?.error || 'Could not save key', true); return false; }
  };
  const clear = async (provider) => {
    try { await automations.clearKey(provider); onChanged(); flash('Key removed'); }
    catch { flash('Could not remove key', true); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', marginTop: '48px', background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: R, boxShadow: '0 16px 48px rgba(0,0,0,.4)', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>AI engine & keys</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: '20px', lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.5 }}>Automations are powered by an AI assistant. Use the built-in MyApi assistant (billed as credits), or add your own key from any provider to run them for free.</p>
        {ai.myapiAi && <WalletControls m={ai.myapiAi} onChanged={onChanged} flash={flash} />}
        <div style={{ margin: '18px 0 8px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Use your own API key (free)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(ai.providers).length === 0 && <p style={{ fontSize: '13px', color: 'var(--ink-3)' }}>Loading…</p>}
          {Object.entries(ai.providers).map(([id, p]) => <ProviderKeyRow key={id} id={id} provider={p} onSave={save} onRemove={clear} />)}
        </div>
      </div>
    </div>
  );
}

function WalletControls({ m, onChanged, flash }) {
  const c2d = (c) => (c == null ? '' : (c / 100).toFixed(2));
  const [limit, setLimit] = useState(m.spendLimitCredits == null ? '' : c2d(m.spendLimitCredits));
  const [alertPct, setAlertPct] = useState(m.alertPercent ?? 80);
  const [ar, setAr] = useState(m.autoReload || { enabled: false, whenBelowCredits: 100, topUpCredits: 1000 });
  const [topUp, setTopUp] = useState('10.00');
  const [saving, setSaving] = useState(false);
  const [buying, setBuying] = useState(false);

  if (!m.allowed) {
    return <Card muted padding={12} style={{ fontSize: '13px', color: 'var(--amber)' }}>The built-in MyApi assistant isn’t available on your plan — add your own key below (free), or upgrade.</Card>;
  }

  const save = async () => {
    setSaving(true);
    try {
      await automations.setWallet({ spendLimitCredits: limit === '' ? null : Math.round(parseFloat(limit) * 100), alertPercent: Number(alertPct), autoReload: { enabled: ar.enabled, whenBelowCredits: Math.round(Number(ar.whenBelowCredits) || 0), topUpCredits: Math.round(Number(ar.topUpCredits) || 1000) } });
      onChanged(); flash('Spend settings saved');
    } catch (e) { flash(e.response?.data?.error || 'Could not save settings', true); }
    finally { setSaving(false); }
  };
  const buy = async () => {
    const cents = Math.round(parseFloat(topUp) * 100);
    if (!cents || cents < 100) return flash('Minimum top-up is $1.00', true);
    setBuying(true);
    try { const r = await automations.topUp(cents); if (r.data?.url) window.location.href = r.data.url; else flash('Could not start checkout', true); }
    catch (e) { flash(e.response?.data?.error || 'Top-up unavailable', true); }
    finally { setBuying(false); }
  };
  const pctOfIncluded = m.includedCredits ? Math.min(100, Math.round((m.usedCredits / m.includedCredits) * 100)) : 0;

  return (
    <Card muted padding={16} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>MyApi AI this month</span>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-3)' }}>1 credit = $0.01 · your own key is free</span>
        </div>
        <div style={{ marginTop: '8px', height: '6px', borderRadius: '999px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
          <div style={{ width: `${pctOfIncluded}%`, height: '100%', background: 'var(--accent-2)' }} />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--ink-2)', marginTop: '8px' }}>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{m.usedCredits}</span> / {m.includedCredits} included credits used
          {m.overageCredits > 0 && <span style={{ color: 'var(--amber)' }}> · {m.overageCredits} over (~${(m.overageCredits / 100).toFixed(2)})</span>}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--ink-2)', marginTop: '4px' }}>Prepaid balance: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{m.balanceCredits} credits</span> (~${(m.balanceCredits / 100).toFixed(2)}) · {m.usedRuns}/{m.monthlyRunCap} runs</div>
        {m.limitReached && <div style={{ fontSize: '11.5px', color: 'var(--amber)', marginTop: '4px' }}>Spend limit reached — runs paused until you raise it or next month.</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ width: '120px' }}><Field label="Add credits ($)" as="input" type="number" value={topUp} onChange={(e) => setTopUp(e.target.value)} /></div>
        <Btn variant="primary" onClick={buy} disabled={buying}>{buying ? 'Opening…' : 'Add credits'}</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field label="Monthly charge limit ($)" as="input" type="number" placeholder="No limit" value={limit} onChange={(e) => setLimit(e.target.value)} hint="Pause MyApi AI after this much beyond your included credits." />
        <Field label="Alert at (% used)" as="input" type="number" value={alertPct} onChange={(e) => setAlertPct(e.target.value)} hint="Notify you when you cross this share." />
      </div>

      <Card padding={12}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink)' }}>
          <input type="checkbox" checked={ar.enabled} onChange={(e) => setAr({ ...ar, enabled: e.target.checked })} /> Auto-reload balance
        </label>
        {ar.enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
            <Field label="When below (credits)" as="input" type="number" value={ar.whenBelowCredits} onChange={(e) => setAr({ ...ar, whenBelowCredits: e.target.value })} />
            <Field label="Top up by (credits)" as="input" type="number" value={ar.topUpCredits} onChange={(e) => setAr({ ...ar, topUpCredits: e.target.value })} />
            <span style={{ gridColumn: '1 / -1', fontSize: '11.5px', color: 'var(--ink-3)' }}>Charges your saved card automatically (respects the limit above).</span>
          </div>
        )}
      </Card>

      <div><Btn variant="secondary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save spend settings'}</Btn></div>
    </Card>
  );
}

function ProviderKeyRow({ id, provider, onSave, onRemove }) {
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState(false);
  const placeholder = id === 'anthropic' ? 'sk-ant-… (your own key)' : id === 'openrouter' ? 'sk-or-… (your own key)' : 'sk-… (your own key)';
  const save = async () => { if (!keyInput.trim()) return; setSaving(true); const ok = await onSave(id, keyInput); setSaving(false); if (ok) setKeyInput(''); };
  return (
    <Card padding={12}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{provider.label}</span>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-3)' }}>{provider.defaultModel}</span>
        </div>
        <Badge tone={provider.platformAvailable ? 'success' : 'neutral'} dot>{provider.platformAvailable ? 'Built-in available' : 'Built-in off'}</Badge>
      </div>
      {provider.byo?.configured ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
          <span style={{ color: 'var(--ink-2)' }}>Personal key <span style={{ color: 'var(--ink-3)' }}>••••{provider.byo.last4}</span></span>
          <Btn size="sm" variant="ghost" onClick={() => onRemove(id)}>Remove</Btn>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input type="password" placeholder={placeholder} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            style={{ flex: 1, minWidth: '220px', boxSizing: 'border-box', background: 'var(--bg-sunk)', color: 'var(--ink)', border: `1px solid ${focus ? 'var(--accent)' : 'var(--line)'}`, boxShadow: focus ? RING : 'none', borderRadius: R, padding: '7px 12px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }} />
          <Btn variant="secondary" onClick={save} disabled={!keyInput.trim() || saving}>{saving ? 'Saving…' : 'Save key'}</Btn>
        </div>
      )}
    </Card>
  );
}
