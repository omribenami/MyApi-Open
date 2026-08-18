import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { completeOnboarding, dismissModal } from '../utils/onboardingUtils';
import { markTourSeen } from '../stores/tourStore';
import { AscKeypairPanel, OAuthInstallerPanel, QuickConnectPanel } from '../components/AgentConnectorPanels';
import {
  ACTIVATION_AIS,
  ACTIVATION_SERVICES,
  MCP_RECOVERY,
  POST_WIN_FEATURES,
  getAiById,
  suggestedServicesFor,
  buildTestDrivePrompts,
} from '../utils/activationMatch';

function Icon({ name, size = 16, strokeWidth = 1.75, style, className }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const props = { width: size, height: size, viewBox: '0 0 24 24', style, className };
  switch (name) {
    case 'check': return <svg {...props} {...s}><polyline points="20 6 9 17 4 12" /></svg>;
    case 'arrowRight': return <svg {...props} {...s}><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
    case 'arrowLeft': return <svg {...props} {...s}><path d="M19 12H5M12 5l-7 7 7 7" /></svg>;
    case 'close': return <svg {...props} {...s}><path d="M18 6 6 18M6 6l12 12" /></svg>;
    case 'shield': return <svg {...props} {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case 'tip': return <svg {...props} {...s}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.5 1 2.3v.5h6V17c0-.8.3-1.7 1-2.3A7 7 0 0 0 12 2z" /></svg>;
    case 'copy': return <svg {...props} {...s}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
    case 'sparkles': return <svg {...props} {...s}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /></svg>;
    case 'bolt': return <svg {...props} {...s}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
    case 'terminal': return <svg {...props} {...s}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
    case 'chevron': return <svg {...props} {...s}><polyline points="9 18 15 12 9 6" /></svg>;
    case 'alertTriangle': return <svg {...props} {...s}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    default: return null;
  }
}

function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ob-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4A8CFF" />
          <stop offset="100%" stopColor="#6058FF" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#ob-logo-grad)" />
      <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function TipCard({ title, body, variant = 'info' }) {
  const color = variant === 'security' ? 'var(--green)' : variant === 'warn' ? 'var(--amber)' : 'var(--accent)';
  const bg = variant === 'security' ? 'var(--green-bg)' : variant === 'warn' ? 'var(--amber-bg)' : 'var(--accent-bg)';
  return (
    <div style={{ borderRadius: 6, background: bg, border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, padding: '10px 14px', display: 'flex', gap: 10 }}>
      <div style={{ color, flexShrink: 0, marginTop: 1 }}>
        <Icon name={variant === 'warn' ? 'alertTriangle' : variant === 'security' ? 'shield' : 'tip'} size={14} />
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color, margin: '0 0 2px' }}>{title}</p>
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  );
}

function StepChip({ index, current, label, onClick }) {
  const active = index === current;
  const complete = index < current;
  return (
    <button onClick={onClick} disabled={!complete && !active} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      borderRadius: 8, border: `1px solid ${active ? 'var(--accent-2)' : 'transparent'}`,
      background: active ? 'var(--accent-bg)' : 'transparent',
      color: active ? 'var(--ink)' : complete ? 'var(--ink-2)' : 'var(--ink-4)',
      cursor: (complete || active) ? 'pointer' : 'not-allowed',
      textAlign: 'left', width: '100%', fontSize: 13, transition: 'all 0.15s',
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
        background: complete ? 'var(--accent)' : active ? 'var(--bg-raised)' : 'var(--bg-sunk)',
        color: complete ? '#fff' : active ? 'var(--accent)' : 'var(--ink-4)',
        border: `1px solid ${complete ? 'var(--accent)' : active ? 'var(--accent-2)' : 'var(--line)'}`,
      }}>
        {complete ? <Icon name="check" size={12} strokeWidth={3} /> : index + 1}
      </span>
      <span style={{ fontWeight: active ? 600 : 500 }}>{label}</span>
    </button>
  );
}

function MobileProgress({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 999,
          background: i <= current ? 'var(--accent)' : 'var(--line)',
          opacity: i <= current ? 1 : 0.5,
        }} />
      ))}
    </div>
  );
}

const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'ai', label: 'Your AI' },
  { id: 'services', label: 'Services' },
  { id: 'agent', label: 'Connect AI' },
  { id: 'testdrive', label: 'Test drive' },
  { id: 'finish', label: 'All set' },
];

const STORAGE_KEY = 'myapi_onboarding_v3';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return { step: 0, data: {} };
}

function oauthIdFor(serviceId) {
  if (['gmail', 'googlecalendar', 'googledrive', 'google'].includes(serviceId)) return 'google';
  return serviceId;
}

function StepWelcome() {
  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo size={36} />
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Get to your first win</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '6px 0 0', lineHeight: 1.55 }}>
            Activation is two things: connect a service, then connect the AI you already use via MCP.
            Personas, scopes, and the rest wait until that works.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { n: '1', t: 'Tell us your main AI', d: 'We match the connector and the services that make it useful.' },
          { n: '2', t: 'Connect at least one service', d: 'OAuth once. Tokens stay on MyApi, never in the agent.' },
          { n: '3', t: 'Connect that AI over MCP', d: 'One prompt. When myapi_status works, you are activated.' },
        ].map((r) => (
          <div key={r.n} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 8, background: 'var(--bg-sunk)', border: '1px solid var(--line)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)', fontWeight: 700 }}>{r.n}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{r.t}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{r.d}</div>
            </div>
          </div>
        ))}
      </div>
      <TipCard variant="security" title="This part is not skippable" body="You can pause and resume. You cannot finish setup until one service and one agent are connected. That is the activation line." />
    </div>
  );
}

function StepAi({ data, update }) {
  const primary = data.primaryAi;
  const extra = data.extraAis || [];
  const toggleExtra = (id) => {
    if (id === primary) return;
    if (extra.includes(id)) update({ extraAis: extra.filter((x) => x !== id) });
    else update({ extraAis: [...extra, id] });
  };
  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>What AI do you use most?</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          Pick the one you will connect first. If you use more than one, add them below — we will offer those after the first win.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }} className="ob-ai-grid">
        {ACTIVATION_AIS.map((ai) => {
          const sel = primary === ai.id;
          return (
            <button key={ai.id} type="button" onClick={() => update({ primaryAi: ai.id, extraAis: extra.filter((x) => x !== ai.id) })} style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
              background: sel ? 'var(--accent-bg)' : 'var(--bg-sunk)',
              border: `1px solid ${sel ? 'var(--accent-2)' : 'var(--line)'}`,
              color: 'var(--ink)',
            }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{ai.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{ai.hint}</div>
            </button>
          );
        })}
      </div>
      {primary && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>Also use (optional)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ACTIVATION_AIS.filter((a) => a.id !== primary && a.id !== 'other').map((ai) => {
              const sel = extra.includes(ai.id);
              return (
                <button key={ai.id} type="button" onClick={() => toggleExtra(ai.id)} style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
                  background: sel ? 'var(--accent-bg)' : 'var(--bg-sunk)',
                  border: `1px solid ${sel ? 'var(--accent-2)' : 'var(--line)'}`,
                  color: sel ? 'var(--accent)' : 'var(--ink-2)',
                }}>{ai.label}</button>
              );
            })}
          </div>
        </div>
      )}
      {primary && (
        <TipCard
          title={`Best connector for ${getAiById(primary).label}`}
          body={`${getAiById(primary).connectorTitle} — ${getAiById(primary).connectorWhy}`}
        />
      )}
    </div>
  );
}

function StepServices({ data }) {
  const connected = data.connected || [];
  const recommended = suggestedServicesFor([data.primaryAi, ...(data.extraAis || [])]);
  const recSet = new Set(recommended.map(oauthIdFor));
  const ordered = [
    ...ACTIVATION_SERVICES.filter((s) => recSet.has(oauthIdFor(s.id))),
    ...ACTIVATION_SERVICES.filter((s) => !recSet.has(oauthIdFor(s.id))),
  ].filter((s, i, arr) => arr.findIndex((x) => oauthIdFor(x.id) === oauthIdFor(s.id)) === i);

  const connectNow = (id) => {
    const params = new URLSearchParams({ mode: 'connect', returnTo: '/dashboard/onboarding', redirect: '1' });
    window.location.href = `/api/v1/oauth/authorize/${oauthIdFor(id)}?${params.toString()}`;
  };

  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Connect at least one service</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          Suggested first for {getAiById(data.primaryAi).label}. One connection is the gate — add more later from Services.
        </p>
      </div>
      <div className="ob-svc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {ordered.map((s) => {
          const oid = oauthIdFor(s.id);
          const sel = connected.includes(oid) || connected.includes(s.id);
          const rec = recSet.has(oid);
          return (
            <button key={s.id} onClick={() => !sel && connectNow(s.id)} disabled={sel} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
              padding: '14px 12px', borderRadius: 8, cursor: sel ? 'default' : 'pointer', textAlign: 'left',
              background: sel ? 'rgba(34,197,94,0.08)' : 'var(--bg-sunk)',
              border: `1.5px solid ${sel ? '#22c55e' : rec ? 'var(--accent-2)' : 'var(--line)'}`,
              color: 'var(--ink)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: sel ? '#22c55e' : 'var(--ink)' }}>
                {s.name}{rec && !sel ? ' · suggested' : ''}
              </span>
              <span style={{ fontSize: 11, color: sel ? 'rgba(34,197,94,0.8)' : 'var(--ink-3)' }}>{sel ? 'Connected' : s.desc}</span>
            </button>
          );
        })}
      </div>
      {connected.length === 0 && (
        <TipCard variant="warn" title="Need one connection to continue" body="This is the first half of the win. Skip is disabled until a service is linked." />
      )}
      {connected.length > 0 && (
        <TipCard variant="security" title={`${connected.length} connected`} body="You can add more later. Continue to connect your AI." />
      )}
    </div>
  );
}

function StepAgent({ data, update, connectingExtra }) {
  const ai = getAiById(connectingExtra || data.primaryAi);
  const extras = (data.extraAis || []).filter((id) => !(data.connectedAgents || []).includes(id));
  const method = data.agentOverride || ai.connector;
  const markConnected = () => {
    const already = data.connectedAgents || [];
    const id = ai.id;
    update({
      agentConnected: true,
      connectedAgents: already.includes(id) ? already : [...already, id],
    });
  };

  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Connect {ai.label}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          {ai.connectorWhy} {ai.mcpConfigHint}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { id: 'quick', label: 'Quick Connect MCP' },
          { id: 'asc', label: 'ASC daemon' },
          { id: 'oauth', label: 'OAuth installer' },
        ].map((m) => (
          <button key={m.id} type="button" onClick={() => update({ agentOverride: m.id })} style={{
            padding: '6px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
            background: method === m.id ? 'var(--accent-bg)' : 'var(--bg-sunk)',
            border: `1px solid ${method === m.id ? 'var(--accent-2)' : 'var(--line)'}`,
            color: method === m.id ? 'var(--accent)' : 'var(--ink-3)',
          }}>{m.label}{m.id === ai.connector ? ' · matched' : ''}</button>
        ))}
      </div>

      {method === 'quick' && (
        <QuickConnectPanel
          defaultAgentName={ai.label}
          onEnrolled={() => markConnected()}
        />
      )}
      {method === 'asc' && <AscKeypairPanel />}
      {method === 'oauth' && <OAuthInstallerPanel />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" onClick={markConnected} style={{
          alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
          background: data.agentConnected ? 'var(--green-bg)' : 'var(--bg-raised)',
          border: `1px solid ${data.agentConnected ? 'var(--green)' : 'var(--line)'}`,
          color: data.agentConnected ? 'var(--green)' : 'var(--ink)',
          fontSize: 13, fontWeight: 600,
        }}>
          {data.agentConnected ? `${ai.label} marked connected` : 'I connected this agent'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: 0 }}>
          Click that after you paste the prompt and the agent enrolls (or after myapi_status succeeds).
        </p>
      </div>

      {data.agentConnected && extras.length > 0 && (
        <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-sunk)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Connect another AI, or continue</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {extras.map((id) => (
              <button key={id} type="button" onClick={() => update({ connectingExtra: id, agentConnected: false, agentOverride: null })} style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
                border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink)',
              }}>
                Connect {getAiById(id).label}
              </button>
            ))}
          </div>
        </div>
      )}

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)' }}>MCP not connecting?</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {MCP_RECOVERY.map((r) => (
            <div key={r.id}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{r.body}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function StepTestDrive({ data, track }) {
  const [copied, setCopied] = useState(null);
  const ai = getAiById(data.primaryAi);
  const prompts = buildTestDrivePrompts({ ai, services: data.connected || [] });
  const copy = (p) => {
    navigator.clipboard?.writeText(p.prompt);
    setCopied(p.id);
    track('test_drive_copied', { step: p.id });
    setTimeout(() => setCopied(null), 1600);
  };
  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Test drive {ai.label}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          Paste these in order. The first one proves MCP. The second is a real read. The third is how you should work from here.
        </p>
      </div>
      {prompts.map((p, i) => (
        <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-sunk)', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{i + 1}. {p.title}</span>
            <button type="button" onClick={() => copy(p)} style={{
              padding: '4px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${copied === p.id ? 'var(--green)' : 'var(--line)'}`,
              background: copied === p.id ? 'var(--green-bg)' : 'var(--bg-raised)',
              color: copied === p.id ? 'var(--green)' : 'var(--ink-2)',
              display: 'inline-flex', gap: 5, alignItems: 'center',
            }}>
              <Icon name={copied === p.id ? 'check' : 'copy'} size={12} />
              {copied === p.id ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre style={{ margin: 0, padding: 12, fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)' }}>{p.prompt}</pre>
        </div>
      ))}
    </div>
  );
}

function StepFinish({ data, onNavigate }) {
  const checks = [
    { label: `${getAiById(data.primaryAi).label} selected`, done: !!data.primaryAi },
    { label: `${(data.connected || []).length} service(s) connected`, done: (data.connected || []).length > 0 },
    { label: 'Agent connected via MCP', done: !!data.agentConnected },
  ];
  return (
    <div className="ob-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, margin: '0 auto 12px', background: 'var(--green-bg)', border: '1px solid var(--green)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
          <Icon name="check" size={28} strokeWidth={2.5} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>You are activated</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
          Service + agent is the win. Everything below is optional and can wait.
        </p>
      </div>
      <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
        {checks.map((c) => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
            <span style={{ width: 16, height: 16, borderRadius: 999, background: c.done ? 'var(--green)' : 'transparent', border: `1px solid ${c.done ? 'var(--green)' : 'var(--line)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {c.done && <Icon name="check" size={9} strokeWidth={4} />}
            </span>
            <span style={{ fontSize: 13 }}>{c.label}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Later, when you need them</div>
        <div className="ob-nextgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {POST_WIN_FEATURES.map((n) => (
            <button key={n.title} onClick={() => onNavigate(n.route)} style={{ padding: 12, textAlign: 'left', borderRadius: 6, background: 'var(--bg-raised)', border: '1px solid var(--line)', cursor: 'pointer', color: 'var(--ink)' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{n.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const masterToken = useAuthStore((s) => s.masterToken);
  const setUser = useAuthStore((s) => s.setUser);

  const saved = loadSaved();
  const [step, setStep] = useState(saved.step || 0);
  const [data, setData] = useState(() => saved.data || {});
  const [mobileSide, setMobileSide] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState(null);

  const update = useCallback((patch) => setData((d) => ({ ...d, ...patch })), []);

  const track = useCallback((event, extra = {}) => {
    try {
      fetch('/api/v1/onboarding/event', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          event,
          primaryAi: data.primaryAi,
          extraAis: data.extraAis || [],
          services: data.connected || [],
          ...extra,
        }),
      }).catch(() => {});
    } catch (_) { /* ignore */ }
  }, [masterToken, data.primaryAi, data.extraAis, data.connected]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const oauthStatus = p.get('oauth_status');
    const oauthService = p.get('oauth_service');
    if (oauthStatus === 'connected' && oauthService) {
      update({ connected: [...new Set([...(data.connected || []), oauthService])] });
      track('service_connected', { services: [oauthService] });
      const connectIdx = STEPS.findIndex((s) => s.id === 'services');
      if (connectIdx >= 0) setStep(connectIdx);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/oauth/status', {
      headers: { Authorization: `Bearer ${masterToken}` },
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list = d?.services || d?.data || d || {};
        const ids = Array.isArray(list)
          ? list.filter((s) => s.connected || s.status === 'connected').map((s) => s.id || s.service || s.name)
          : Object.entries(list).filter(([, v]) => v === true || v?.connected).map(([k]) => k);
        if (ids.length) update({ connected: [...new Set([...(data.connected || []), ...ids.filter(Boolean)])] });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterToken]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data })); } catch (_) { /* ignore */ }
  }, [step, data]);

  useEffect(() => {
    track('step_viewed', { step: STEPS[step]?.id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const sid = STEPS[step].id;
  const canAdvance = (() => {
    if (sid === 'ai') return !!data.primaryAi;
    if (sid === 'services') return (data.connected || []).length > 0;
    if (sid === 'agent') return !!data.agentConnected;
    return true;
  })();

  const handleAdvance = async () => {
    if (!canAdvance) return;
    setStepError(null);
    if (sid === 'ai') track('ai_selected');
    if (sid === 'agent') track('agent_connected');
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const handleFinish = async ({ tour = false } = {}) => {
    setSaving(true);
    track('activation_complete');
    try {
      await fetch('/api/v1/onboarding/complete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` },
        credentials: 'include',
      });
      completeOnboarding();
      dismissModal();
      if (setUser && user) setUser({ ...user, needsOnboarding: false });
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    } catch { /* never trap the user */ }
    markTourSeen();
    if (tour) {
      try { sessionStorage.setItem('myapi_pending_tour', '1'); } catch (_) { /* ignore */ }
    }
    navigate('/');
  };

  const goTo = (i) => { if (i < step) setStep(i); };
  const back = () => { if (step > 0) { setStep((s) => s - 1); setStepError(null); } };
  const isFinish = step === STEPS.length - 1;

  const onNavigate = (route) => {
    handleFinish().then(() => navigate(route));
  };

  const renderStep = () => {
    if (sid === 'welcome') return <StepWelcome />;
    if (sid === 'ai') return <StepAi data={data} update={update} />;
    if (sid === 'services') return <StepServices data={data} />;
    if (sid === 'agent') return <StepAgent data={data} update={update} connectingExtra={data.connectingExtra} />;
    if (sid === 'testdrive') return <StepTestDrive data={data} track={track} />;
    if (sid === 'finish') return <StepFinish data={data} onNavigate={onNavigate} />;
    return null;
  };

  const gateHint = !canAdvance && sid === 'services'
    ? 'Connect one service to continue'
    : !canAdvance && sid === 'agent'
      ? 'Connect your AI (or mark it connected) to continue'
      : !canAdvance && sid === 'ai'
        ? 'Pick your main AI'
        : null;

  return (
    <>
      <style>{`
        @keyframes ob-step-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .ob-step-enter { animation: ob-step-in 0.32s cubic-bezier(0.2,0.8,0.2,1) both; }
        @keyframes ob-spin { to { transform: rotate(360deg); } }
        @keyframes ob-slide-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .ob-sidebar { display: flex !important; }
        .ob-mobile-header { display: none !important; }
        .ob-mobile-progress { display: none !important; }
        .ob-desktop-only { display: inline !important; }
        @media (max-width: 860px) {
          .ob-sidebar { display: none !important; }
          .ob-mobile-header { display: flex !important; }
          .ob-mobile-progress { display: block !important; }
          .ob-content-col { padding: 20px 16px 24px !important; max-width: 100% !important; }
          .ob-footer { padding: 12px 16px !important; }
          .ob-desktop-only { display: none !important; }
          .ob-layout { flex-direction: column !important; }
          .ob-svc-grid, .ob-ai-grid { grid-template-columns: 1fr 1fr !important; }
          .ob-nextgrid { grid-template-columns: 1fr !important; }
          input, textarea, select { font-size: 16px !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
        <div style={{ display: 'flex', flex: 1 }} className="ob-layout">
          <aside className="ob-sidebar" style={{
            width: 260, padding: 24, borderRight: '1px solid var(--line)',
            background: 'var(--bg-sunk)', flexDirection: 'column', gap: 20,
            height: '100vh', position: 'sticky', top: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Logo size={28} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>MyApi</span>
            </div>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>Activation</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{step + 1} of {STEPS.length}</div>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              {STEPS.map((s, i) => (
                <StepChip key={s.id} index={i} current={step} label={s.label} onClick={() => goTo(i)} />
              ))}
            </nav>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-raised)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              First win = 1 service + 1 AI. Progress saves locally.
            </div>
          </aside>

          <header className="ob-mobile-header" style={{
            position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', borderBottom: '1px solid var(--line)',
            padding: '12px 16px', alignItems: 'center', gap: 12,
          }}>
            <button style={{ padding: 8, background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--ink-2)', display: 'flex', cursor: 'pointer' }} onClick={() => setMobileSide(true)}>
              <Icon name="chevron" size={18} />
            </button>
            <Logo size={22} />
            <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Setup</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--ink-3)' }}>{step + 1}/{STEPS.length}</span>
          </header>

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="ob-mobile-progress" style={{ padding: '12px 16px 0' }}>
              <MobileProgress current={step} total={STEPS.length} />
            </div>
            <div className="ob-content-col" style={{ flex: 1, padding: '40px 48px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
              {renderStep()}
            </div>
            <footer className="ob-footer" style={{
              borderTop: '1px solid var(--line)', padding: '14px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg)', position: 'sticky', bottom: 0,
            }}>
              <div>
                {step > 0 && !isFinish && (
                  <button onClick={back} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 500, border: '1px solid var(--line)', background: 'var(--bg-raised)', color: 'var(--ink)', borderRadius: 6, cursor: 'pointer', minHeight: 36 }}>
                    <Icon name="arrowLeft" size={14} /> Back
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(stepError || gateHint) && (
                  <span style={{ fontSize: 12, color: stepError ? 'var(--red)' : 'var(--ink-3)' }}>{stepError || gateHint}</span>
                )}
                {!isFinish ? (
                  <button onClick={handleAdvance} disabled={!canAdvance || saving} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: (!canAdvance || saving) ? 'not-allowed' : 'pointer',
                    background: 'var(--accent-2)', color: '#fff', border: '1px solid rgba(240,246,252,0.1)',
                    opacity: (!canAdvance || saving) ? 0.5 : 1, minHeight: 36,
                  }}>
                    {sid === 'welcome' ? 'Get started' : sid === 'testdrive' ? 'Finish setup' : 'Continue'}
                    <Icon name="arrowRight" size={14} />
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleFinish({ tour: false })} disabled={saving} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                      fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer',
                      background: 'var(--bg-raised)', color: 'var(--ink)', border: '1px solid var(--line)', minHeight: 36,
                    }}>Finish</button>
                    <button onClick={() => handleFinish({ tour: true })} disabled={saving} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                      fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer',
                      background: 'var(--accent-2)', color: '#fff', border: '1px solid rgba(240,246,252,0.1)', minHeight: 36,
                    }}>
                      <Icon name="sparkles" size={14} /> Take a tour
                    </button>
                  </>
                )}
              </div>
            </footer>
          </main>
        </div>

        {mobileSide && (
          <div onClick={() => setMobileSide(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)' }}>
            <aside onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 280,
              background: 'var(--bg-raised)', borderRight: '1px solid var(--line)',
              padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
              animation: 'ob-slide-left 0.25s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Logo size={24} /><span style={{ fontWeight: 600 }}>MyApi</span></div>
                <button style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex' }} onClick={() => setMobileSide(false)}>
                  <Icon name="close" size={16} />
                </button>
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {STEPS.map((s, i) => (
                  <StepChip key={s.id} index={i} current={step} label={s.label} onClick={() => { goTo(i); setMobileSide(false); }} />
                ))}
              </nav>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
