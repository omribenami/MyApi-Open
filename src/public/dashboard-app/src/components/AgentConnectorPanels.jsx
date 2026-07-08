import { useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/apiClient';

// ─── CopyBlock ─────────────────────────────────────────────────────────────────
export function CopyBlock({ text, label, accent = 'blue' }) {
  const [copied, setCopied] = useState(false);
  const isViolet = accent === 'violet';
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <div style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--line)' }}>
        <span className="micro" style={{ color: 'var(--ink-4)' }}>{label}</span>
        <button
          onClick={copy}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: isViolet ? '#a78bfa' : 'var(--accent)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {copied ? (
            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Copied</>
          ) : (
            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
          )}
        </button>
      </div>
      <pre className="mono" style={{ fontSize: '11px', color: 'var(--ink-2)', padding: '12px', overflowX: 'auto', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'JetBrains Mono, monospace' }}><code>{text}</code></pre>
    </div>
  );
}

// ─── Step ──────────────────────────────────────────────────────────────────────
export function Step({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: '14px', paddingBottom: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <span style={{
          width: '20px', height: '20px', borderRadius: '50%',
          background: 'var(--bg-hover)', border: '1px solid var(--line)',
          color: 'var(--ink-3)', fontSize: '11px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{n}</span>
        <div style={{ width: '1px', flex: 1, background: 'var(--line)', minHeight: '16px', marginTop: '4px' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>{title}</p>
        {children}
      </div>
    </div>
  );
}

// ─── OAuthInstallerPanel constants ─────────────────────────────────────────────
const OAUTH_AGENT_PROMPT = `I ran the MyApi agent auth installer on my machine and got this access token:

myapi_PASTE_TOKEN_HERE

Please save this as your MyApi Bearer token and use it for all API requests:
  Authorization: Bearer myapi_PASTE_TOKEN_HERE
  Base URL: https://www.myapiai.com/api/v1/

Do not ask me to run the installer — I already ran it. Just use this token.`;

// ─── OAuthInstallerPanel ───────────────────────────────────────────────────────
export function OAuthInstallerPanel() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderRadius: '6px', border: '1px solid var(--accent-bg)', background: 'var(--accent-bg)', padding: '12px 16px', marginBottom: '20px' }}>
        <svg style={{ width: '16px', height: '16px', color: 'var(--accent)', marginTop: '2px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p style={{ fontSize: '12px', color: 'var(--accent)', lineHeight: '1.5' }}>
          <strong style={{ fontWeight: 600 }}>You run this on your machine</strong> — not the agent. Agents in sandboxes can't receive localhost callbacks.
        </p>
      </div>

      <Step n="1" title="Run the installer on your machine">
        <CopyBlock label="terminal" accent="blue" text="curl -sL https://www.myapiai.com/api/v1/agent-auth/install.js | node" />
        <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '8px', lineHeight: '1.5' }}>Your browser opens. Once you authorize, the terminal prints a token starting with <span className="mono" style={{ color: 'var(--ink)' }}>myapi_</span></p>
      </Step>

      <Step n="2" title="Give the token to your agent">
        <CopyBlock label="agent prompt" accent="blue" text={OAUTH_AGENT_PROMPT} />
      </Step>

      <div style={{ borderRadius: '6px', background: 'var(--bg-raised)', border: '1px solid var(--line)', padding: '14px 16px' }}>
        <p className="micro" style={{ color: 'var(--ink-4)', marginBottom: '8px' }}>Optional flags</p>
        <div className="mono" style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--ink-3)' }}>
          <p><span style={{ color: 'var(--ink)' }}>--save</span>  → saves token to <span style={{ color: 'var(--ink-2)' }}>~/.myapi/agent-token.json</span></p>
          <p><span style={{ color: 'var(--ink)' }}>--json</span>  → outputs <span style={{ color: 'var(--ink-2)' }}>{'{"token":"myapi_..."}'}</span> for scripting</p>
        </div>
      </div>
    </div>
  );
}

// ─── AscKeypairPanel constants ─────────────────────────────────────────────────
const ASC_AGENT_PROMPT = `My MyApi account is connected via ASC (Agentic Secure Connection).

The MCP daemon is already running on this machine. Add this to your MCP configuration and restart:

{
  "mcpServers": {
    "myapi": {
      "url": "http://127.0.0.1:9587/mcp"
    }
  }
}

Once connected, call myapi_status to verify you are approved and ready.
All requests are signed automatically — no token or key needed on your end.`;

const ASC_INSTALL_CMD = `sudo bash -c "$(curl -fsSL https://www.myapiai.com/install/asc)"`;

const ASC_MCP_CONFIG = `{
  "mcpServers": {
    "myapi": {
      "url": "http://127.0.0.1:9587/mcp"
    }
  }
}`;

const MANUAL_KEYGEN = `# Generate once — keep ed25519.pem secret
openssl genpkey -algorithm ed25519 -out ed25519.pem
openssl pkey -in ed25519.pem -pubout -outform DER | tail -c 32 | base64`;

const MANUAL_SIGN = `# Per request — Bash (fingerprint = sha256(pubkey_b64).hex[:32])
TS=$(date +%s)
PUB=$(openssl pkey -in ed25519.pem -pubout -outform DER | tail -c 32 | base64 -w0)
FP=$(echo -n "$PUB" | sha256sum | cut -c1-32)
SIG=$(printf "$TS:$FP" | openssl pkeyutl -sign -inkey ed25519.pem -rawin | base64 -w0)
curl -H "X-Agent-PublicKey: $PUB" \\
     -H "X-Agent-Signature: $SIG" \\
     -H "X-Agent-Timestamp: $TS" \\
     $MYAPI_URL/api/v1/identity`;

// ─── TokenScopePicker ──────────────────────────────────────────────────────────
// "Access level" for a new agent key: full account access, or inherit the
// scopes of one of the user's existing scoped tokens (created in Access Tokens).
export function TokenScopePicker({ value, onChange, accent = '#a78bfa' }) {
  const [scopedTokens, setScopedTokens] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiClient.get('/tokens')
      .then(({ data }) => {
        // API shape: { data: [...] }
        const raw = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        const list = raw.filter((t) =>
          t.tokenType !== 'master' && t.active !== false && !t.revokedAt && (t.scopes || []).length > 0
        );
        setScopedTokens(list);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const selected = scopedTokens.find((t) => t.tokenId === value);

  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
        Access level
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ marginTop: '4px', width: '100%', minHeight: '44px', padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-sunk)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: '12px' }}
        >
          <option value="full">Full access — agent can use everything on your account</option>
          {scopedTokens.map((t) => (
            <option key={t.tokenId} value={t.tokenId}>
              Scoped like “{t.label || t.tokenId}” — {(t.scopes || []).slice(0, 3).join(', ')}{(t.scopes || []).length > 3 ? ` +${t.scopes.length - 3} more` : ''}
            </option>
          ))}
        </select>
      </label>
      {value !== 'full' && selected && (
        <div style={{ marginTop: '6px', borderRadius: '6px', padding: '7px 10px', fontSize: '11px', lineHeight: 1.5, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', color: '#c4b5fd' }}>
          This agent will be permanently limited to: <span style={{ fontFamily: 'monospace' }}>{(selected.scopes || []).join(', ')}</span>.
          Everything else returns 403. The scopes are copied at registration — revoking the template token later does not affect the agent.
        </div>
      )}
      <p style={{ fontSize: '11px', color: 'var(--ink-4)', marginTop: '6px', lineHeight: 1.5 }}>
        {loaded && scopedTokens.length === 0
          ? <>No scoped tokens yet — create one in <a href="/dashboard/access-tokens" style={{ color: accent, textDecoration: 'underline', textUnderlineOffset: '2px' }}>Access Tokens</a> (e.g. Gmail read-only), then reload this page to pick it here.</>
          : <>Want a narrower option? Create more scoped tokens in <a href="/dashboard/access-tokens" style={{ color: accent, textDecoration: 'underline', textUnderlineOffset: '2px' }}>Access Tokens</a>.</>}
      </p>
    </div>
  );
}

// ─── QuickConnectPanel ─────────────────────────────────────────────────────────
// One-prompt agent setup: pick access level → generate a one-time enrollment
// code → hand the agent a single copy-paste prompt. The agent's MCP generates
// its own Ed25519 key and exchanges the code for a pre-approved registration.
// No token is ever shown to the agent; the code self-destructs after one use.
function buildQuickPrompt(code) {
  return `Connect yourself to my MyApi account (takes ~30 seconds, fully automatic):

1. Add this to your MCP configuration and restart your MCP servers:

{
  "mcpServers": {
    "myapi": {
      "command": "npx",
      "args": ["-y", "myapi-asc-mcp"],
      "env": {
        "MYAPI_ENROLL_CODE": "${code}"
      }
    }
  }
}

2. Call the myapi_status tool. It will enroll automatically using the one-time code and print your access level and available services.

Security notes for you (the agent): the code above is NOT a credential — it is single-use, expires in 15 minutes, and becomes useless the moment you enroll. Your identity is an Ed25519 key generated locally on this machine; it never leaves the machine and no account token is ever shared with you.`;
}

export function QuickConnectPanel() {
  const [accessLevel, setAccessLevel] = useState('full');
  const [agentName, setAgentName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [issued, setIssued] = useState(null); // { code, expires_at, scope }
  const [error, setError] = useState('');
  const [enrolled, setEnrolled] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);

  const generate = async () => {
    setError('');
    setIssued(null);
    setEnrolled(null);
    setGenerating(true);
    try {
      const { data } = await apiClient.post('/agentic/asc/enroll-code', {
        bind_token_id: accessLevel !== 'full' ? accessLevel : undefined,
        label: agentName.trim() || undefined,
      });
      setIssued(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not generate a setup prompt');
    } finally {
      setGenerating(false);
    }
  };

  // Expiry countdown
  useEffect(() => {
    if (!issued) { setSecondsLeft(null); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((new Date(issued.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [issued]);

  // Poll Devices until the agent enrolls
  useEffect(() => {
    if (!issued || enrolled) return;
    const startedAt = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - startedAt > 16 * 60 * 1000) { clearInterval(id); return; }
      try {
        const { data } = await apiClient.get('/devices/approved');
        const found = (data.devices || []).find((d) =>
          new Date(d.approvedAt || 0).getTime() > startedAt - 5000 &&
          (d.info?.enrolledVia === 'quick_connect' || d.info?.type === 'asc')
        );
        if (found) setEnrolled({ name: found.name || 'AI Agent' });
      } catch (_) { /* polling */ }
    }, 4000);
    return () => clearInterval(id);
  }, [issued, enrolled]);

  return (
    <div>
      <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '16px', lineHeight: 1.6 }}>
        Pick what the agent may access, generate a prompt, paste it into your agent. Done.
        The agent never sees a token — it gets a <strong style={{ color: 'var(--ink-2)' }}>single-use code</strong>{' '}
        (15-minute expiry) and proves itself with a key that never leaves its machine. Revoke anytime in{' '}
        <a href="/dashboard/devices" style={{ color: 'var(--green)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Devices</a>.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <TokenScopePicker value={accessLevel} onChange={setAccessLevel} accent="var(--green)" />
        <label style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
          Agent name <span style={{ color: 'var(--ink-4)' }}>(optional — shown in Devices)</span>
          <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g. claude-desktop, my-cursor" maxLength={100}
            style={{ marginTop: '4px', width: '100%', minHeight: '44px', padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-sunk)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: '12px' }} />
        </label>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '7px 12px', color: '#fca5a5', fontSize: '12px' }}>{error}</div>
        )}
        <button onClick={generate} disabled={generating} style={{
          alignSelf: 'flex-start', minHeight: '44px', padding: '10px 18px', borderRadius: '6px',
          background: generating ? 'var(--accent-mute)' : 'var(--green)',
          color: '#fff', border: 'none', cursor: generating ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600,
        }}>
          {generating ? 'Generating…' : (issued ? 'Generate a new prompt' : 'Generate setup prompt')}
        </button>
      </div>

      {issued && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <CopyBlock label="paste this into your agent" accent="blue" text={buildQuickPrompt(issued.code)} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '11px' }}>
            <span style={{ color: 'var(--ink-4)' }}>
              access: <span style={{ color: Array.isArray(issued.scope) ? '#c4b5fd' : 'var(--ink-2)' }}>
                {Array.isArray(issued.scope) ? issued.scope.join(', ') : 'full account'}
              </span>
            </span>
            <span style={{ color: 'var(--ink-4)' }}>·</span>
            <span style={{ color: secondsLeft === 0 ? '#fca5a5' : 'var(--ink-4)' }}>
              {secondsLeft === 0 ? 'code expired — generate a new prompt' : `code expires in ${Math.floor((secondsLeft || 0) / 60)}:${String((secondsLeft || 0) % 60).padStart(2, '0')}`}
            </span>
          </div>
          <div style={{ borderRadius: '6px', padding: '8px 12px', fontSize: '12px',
            background: enrolled ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
            border: `1px solid ${enrolled ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`,
            color: enrolled ? '#86efac' : '#fcd34d' }}>
            {enrolled
              ? `✓ "${enrolled.name}" enrolled and connected. Manage or revoke it in Devices.`
              : '⏳ Waiting for the agent to enroll — this updates automatically.'}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AscKeypairPanel ───────────────────────────────────────────────────────────
export function AscKeypairPanel() {
  const [publicKey, setPublicKey] = useState('');
  const [label, setLabel] = useState('');
  const [accessLevel, setAccessLevel] = useState('full');
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [ascError, setAscError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setAscError('');
    setRegistration(null);
    const trimmedKey = publicKey.trim();
    if (!trimmedKey) { setAscError('Paste the public key your agent gave you.'); return; }
    setRegistering(true);
    try {
      const { data } = await apiClient.post('/agentic/asc/register', {
        public_key: trimmedKey,
        label: label.trim() || undefined,
        bind_token_id: accessLevel !== 'full' ? accessLevel : undefined,
      });
      setRegistration(data);
      if (data.status === 'pending_approval' && data.key_fingerprint) {
        setPendingApproval({ keyFingerprint: data.key_fingerprint, approved: false });
      }
    } catch (err) {
      setAscError(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  useEffect(() => {
    if (!pendingApproval || pendingApproval.approved) return;
    const id = setInterval(async () => {
      try {
        const { data } = await apiClient.get('/devices/approved');
        const found = data.devices?.find((d) => d.fingerprint === pendingApproval.keyFingerprint);
        if (found) setPendingApproval((p) => ({ ...p, approved: true, deviceName: found.name }));
      } catch (_) {
        // polling — ignore transient errors
      }
    }, 4000);
    return () => clearInterval(id);
  }, [pendingApproval]);

  return (
    <div>
      <Step n="1" title="Install the ASC daemon on your Linux machine">
        <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '10px', lineHeight: '1.5' }}>
          Run this once on the machine where your agent lives. It creates a dedicated system user,
          generates an Ed25519 keypair, and starts a local MCP server on{' '}
          <code style={{ fontFamily: 'monospace' }}>127.0.0.1:9587</code>.
          The private key never leaves the machine.
        </p>
        <CopyBlock text={ASC_INSTALL_CMD} label="bash · run as sudo" accent="violet" />
        <p style={{ fontSize: '11px', color: 'var(--ink-4)', marginTop: '8px', lineHeight: '1.5' }}>
          The script prints your <strong style={{ color: 'var(--ink-3)' }}>PUBLIC KEY</strong> when done — paste it in Step 2.
          Re-running is safe (idempotent). Supports <code style={{ fontFamily: 'monospace' }}>install</code>{' '}
          · <code style={{ fontFamily: 'monospace' }}>status</code>{' '}
          · <code style={{ fontFamily: 'monospace' }}>rotate</code>{' '}
          · <code style={{ fontFamily: 'monospace' }}>uninstall</code>.
        </p>
      </Step>

      <Step n="2" title="Paste the public key the script printed">
        <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '10px', lineHeight: '1.5' }}>
          The install script prints a <strong style={{ color: 'var(--ink-3)' }}>PUBLIC KEY</strong> at the end.
          Paste it here to register this machine to your account.
        </p>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <TokenScopePicker value={accessLevel} onChange={setAccessLevel} />
          <label style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
            Agent label <span style={{ color: 'var(--ink-4)' }}>(optional — shown in Devices)</span>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. my-claude-agent, prod-worker" maxLength={100}
              style={{ marginTop: '4px', width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-sunk)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: '12px' }} />
          </label>
          <label style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
            Public key <span style={{ color: 'var(--ink-4)' }}>(paste from your agent's myapi_status output)</span>
            <textarea value={publicKey} onChange={(e) => setPublicKey(e.target.value)}
              placeholder="MCowBQYDK2VwAyEA…" rows={3}
              style={{ marginTop: '4px', width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-sunk)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical' }} />
          </label>
          {ascError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '7px 12px', color: '#fca5a5', fontSize: '12px' }}>{ascError}</div>
          )}
          <button type="submit" disabled={registering} style={{
            alignSelf: 'flex-start', padding: '8px 16px', borderRadius: '6px',
            background: registering ? 'var(--accent-mute)' : '#a78bfa',
            color: '#fff', border: 'none', cursor: registering ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600,
          }}>
            {registering ? 'Registering…' : 'Register public key'}
          </button>
        </form>
        {registration && (
          <div style={{ marginTop: '10px', background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px 12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--ink-3)' }}>Status</div>
            <div style={{ fontSize: '12px', color: 'var(--ink)', marginTop: '2px' }}>
              {registration.status === 'already_approved' ? '✓ Already approved' : 'Registered — approve it in Devices to activate'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginTop: '4px', fontFamily: 'monospace' }}>
              fingerprint: {registration.key_fingerprint}
            </div>
            <div style={{ fontSize: '11px', marginTop: '4px', color: Array.isArray(registration.scope) ? '#c4b5fd' : 'var(--ink-4)' }}>
              access: {Array.isArray(registration.scope) ? `scoped — ${registration.scope.join(', ')}` : 'full account'}
            </div>
          </div>
        )}
      </Step>

      <Step n="3" title="Approve in Devices">
        <p style={{ fontSize: '12px', color: 'var(--ink-3)', lineHeight: '1.5' }}>
          Go to <a href="/dashboard/devices" style={{ color: '#a78bfa', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Devices</a> and click{' '}
          <strong style={{ color: 'var(--ink)' }}>Approve</strong> on the pending entry.
          Verify approval anytime:{' '}
          <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>curl -s http://127.0.0.1:9587/status</code>
        </p>
        {pendingApproval && (
          <div style={{ marginTop: '8px', borderRadius: '6px', padding: '8px 12px', fontSize: '12px',
            background: pendingApproval.approved ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
            border: `1px solid ${pendingApproval.approved ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`,
            color: pendingApproval.approved ? '#86efac' : '#fcd34d' }}>
            {pendingApproval.approved
              ? `✓ Approved as "${pendingApproval.deviceName || 'ASC Agent'}". Agent is ready.`
              : '⏳ Waiting for approval — this updates automatically once you click Approve.'}
          </div>
        )}
      </Step>

      <Step n="4" title="Point your agent at the local MCP endpoint">
        <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '10px', lineHeight: '1.5' }}>
          Add this to your agent's MCP config and restart it. Works with any MCP-capable agent.
          All requests are signed automatically — no token or key needed on the agent side.
        </p>
        <CopyBlock text={ASC_MCP_CONFIG} label="MCP client config" accent="violet" />
        <p style={{ fontSize: '11px', color: 'var(--ink-4)', marginTop: '8px', lineHeight: '1.5' }}>
          Then paste the prompt below into your agent to confirm the connection:
        </p>
        <CopyBlock text={ASC_AGENT_PROMPT} label="paste into agent to confirm" accent="violet" />
      </Step>

      <details style={{ marginTop: '8px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--ink-4)', userSelect: 'none' }}>
          Manual setup — for agents without MCP support
        </summary>
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '8px', lineHeight: '1.5' }}>
              Generate a keypair on the agent host, then paste the public key into the form above:
            </p>
            <CopyBlock text={MANUAL_KEYGEN} label="bash · generate keypair" />
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '8px', lineHeight: '1.5' }}>
              Sign every request — no bearer token required, fingerprint is the signing identity:
            </p>
            <CopyBlock text={MANUAL_SIGN} label="bash · sign per request" />
          </div>
        </div>
      </details>
    </div>
  );
}

// ─── MasterTokenPanel ──────────────────────────────────────────────────────────
export function MasterTokenPanel() {
  return (
    <div>
      <Step n="1" title="Copy a token — master or scoped">
        <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '10px', lineHeight: '1.5' }}>
          Go to <a href="/dashboard/access-tokens" style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Access Tokens</a> and copy a token — it starts with <span style={{ fontFamily: 'monospace', color: 'var(--ink-2)' }}>myapi_</span>.
          Your <strong style={{ color: 'var(--ink-2)' }}>master token</strong> gives the agent full access; a <strong style={{ color: 'var(--ink-2)' }}>scoped token</strong> (create one on the same page, e.g. Gmail read-only) limits the agent to exactly those permissions — everything else returns 403.
        </p>
      </Step>
      <Step n="2" title="Give the token to your agent">
        <CopyBlock label="agent prompt" accent="blue" text={`Use this as my MyApi Bearer token for all API requests:
  Authorization: Bearer myapi_PASTE_TOKEN_HERE
  Base URL: https://www.myapiai.com/api/v1/`} />
      </Step>
      <div style={{ borderRadius: '6px', border: '1px solid rgba(210,153,34,0.25)', background: 'rgba(210,153,34,0.08)', padding: '10px 14px' }}>
        <p style={{ fontSize: '12px', color: 'var(--amber)', lineHeight: '1.5' }}>
          Master token grants full access to all agents. For production use, prefer ASC or OAuth PKCE — they issue per-agent tokens you can revoke individually.
        </p>
      </div>
    </div>
  );
}

// ─── CompareMethodsPanel ───────────────────────────────────────────────────────
function CellValue({ value }) {
  if (value === '✓ Yes') return <span style={{ fontWeight: 600, color: 'var(--green)' }}>✓ Yes</span>;
  if (value === '✗ No')  return <span style={{ fontWeight: 600, color: 'var(--red)' }}>✗ No</span>;
  return <span style={{ color: 'var(--ink-2)' }}>{value}</span>;
}

export function CompareMethodsPanel() {
  const rows = [
    ['Pre-existing token needed', '✓ Yes', '✗ No',  '✗ No' ],
    ['Requires browser (once)',   '✗ No',  '✓ Yes', '✗ No' ],
    ['Per-agent token',           '✗ No',  '✓ Yes', '✓ Yes'],
    ['Revoke one agent only',     '✗ No',  '✓ Yes', '✓ Yes'],
    ['Works across IPs',          '— Fingerprint', '✓ Yes', '✓ Yes'],
    ['Cryptographic proof',       '✗ No',  '✗ No',  '✓ Yes'],
    ['Replay protection',         '✗ No',  '✗ No',  '✓ Yes'],
    ['Setup complexity',          'None',  'Low',   'Medium'],
  ];
  return (
    <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid rgba(167,139,250,0.35)' }}>
      <table style={{ width: '100%', fontSize: '12px', minWidth: '400px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-raised)' }}>
            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--ink-4)', fontWeight: 500, width: '176px' }}></th>
            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--ink-2)', fontWeight: 600 }}>Master Token</th>
            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--accent)', fontWeight: 600 }}>OAuth PKCE</th>
            <th style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(167,139,250,0.07)', fontWeight: 600 }}>
              <div style={{ color: '#a78bfa' }}>ASC Keypair</div>
              <div style={{ fontSize: '10px', fontWeight: 600, marginTop: '3px', padding: '1px 7px', borderRadius: '4px', background: 'rgba(167,139,250,0.25)', color: '#c4b5fd', display: 'inline-block' }}>★ Recommended</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, master, oauth, asc], i) => (
            <tr key={label} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
              <td style={{ padding: '10px 16px', color: 'var(--ink-2)' }}>{label}</td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}><CellValue value={master} /></td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}><CellValue value={oauth} /></td>
              <td style={{ padding: '10px 8px', textAlign: 'center', background: 'rgba(167,139,250,0.04)' }}><CellValue value={asc} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
