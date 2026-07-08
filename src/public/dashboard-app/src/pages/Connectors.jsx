import { useEffect, useState } from 'react';
import apiClient from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';
import {
  CopyBlock,
  OAuthInstallerPanel,
  AscKeypairPanel,
  QuickConnectPanel,
  MasterTokenPanel,
  CompareMethodsPanel,
} from '../components/AgentConnectorPanels';

// ─── Assistants ────────────────────────────────────────────────────────────────
const ASSISTANTS = [
  {
    id: 'chatgpt', name: 'ChatGPT', provider: 'OpenAI', status: 'available',
    href: 'https://chatgpt.com/g/g-69a90f35a0888191ae6346c9b129b9a8-myapi-assistant',
    description: 'Ask ChatGPT questions about your MyApi data — no setup required.',
    iconColor: 'var(--green)', iconBg: 'var(--green-bg)',
    logo: <svg viewBox="0 0 24 24" style={{width:'18px',height:'18px'}} fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387 2.019-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.411-.663zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>,
  },
  {
    id: 'claude', name: 'Claude', provider: 'Anthropic', status: 'coming_soon', href: null,
    description: 'Connect Claude AI agents to your MyApi account.',
    iconColor: '#fb923c', iconBg: 'rgba(251,146,60,0.15)',
    logo: <svg viewBox="0 0 24 24" style={{width:'18px',height:'18px'}} fill="currentColor"><path d="M17.304 3.541 12.001 17.51 6.697 3.541H3L9.999 21h4.003L21 3.541h-3.696z"/></svg>,
  },
  {
    id: 'copilot', name: 'GitHub Copilot', provider: 'Microsoft', status: 'coming_soon', href: null,
    description: 'Expose your MyApi data to Copilot extensions.',
    iconColor: 'var(--accent)', iconBg: 'var(--accent-bg)',
    logo: <svg viewBox="0 0 24 24" style={{width:'18px',height:'18px'}} fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>,
  },
];

// ─── OS logos ──────────────────────────────────────────────────────────────────
const LinuxLogo = ({ className, style }) => (<svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-.703 2.388-.395.431-.658.308-.658.308s-3.027-.547-4.856-.547c-1.713 0-2.637 2.737-2.637 4.508v2.726c0 .593.215 1.181.62 1.629.294.326.648.532 1.026.641l.145.038-.059.194c-.108.36-.162.74-.162 1.123 0 1.893 1.545 3.43 3.443 3.43.924 0 1.758-.358 2.384-.941l.045-.043.149.155c.634.657 1.517 1.065 2.498 1.065h.003c.98 0 1.864-.408 2.498-1.065l.149-.155.045.043c.626.583 1.46.941 2.384.941 1.898 0 3.443-1.537 3.443-3.43 0-.383-.054-.763-.162-1.123l-.059-.194.145-.038c.378-.109.732-.315 1.026-.641.405-.448.62-1.036.62-1.629v-2.726c0-1.771-.924-4.508-2.637-4.508-1.829 0-4.856.547-4.856.547s-.263.123-.658-.308c-.403-.435-.627-1.296-.703-2.388-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021z"/></svg>);
const AppleLogo = ({ className, style }) => (<svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>);
const WindowsLogo = ({ className, style }) => (<svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>);

function getPlatformMeta(platform) {
  switch (platform) {
    case 'linux':  return { label: 'Linux',   Logo: LinuxLogo,   iconColor: 'var(--amber)',  iconBg: 'rgba(210,153,34,0.15)'  };
    case 'darwin': return { label: 'macOS',   Logo: AppleLogo,   iconColor: 'var(--ink-2)',  iconBg: 'rgba(145,152,161,0.15)' };
    case 'win32':  return { label: 'Windows', Logo: WindowsLogo, iconColor: 'var(--accent)', iconBg: 'var(--accent-bg)'       };
    default:       return { label: platform || 'Unknown', Logo: null, iconColor: 'var(--ink-3)', iconBg: 'rgba(110,118,129,0.15)' };
  }
}

function fmtBytes(bytes) {
  if (!bytes) return '';
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

// Desktop installers. Availability is resolved at runtime from
// /afp/installer-info — a platform shows a Download button once its binary is
// published (macOS auto-activates when the signed .dmg lands), otherwise
// "Coming soon". No code change needed when macOS builds start shipping.
const DESKTOP_PLATFORMS = [
  {
    platform: 'mac-arm', label: 'macOS', sublabel: 'Apple Silicon',
    Logo: AppleLogo, iconColor: 'var(--ink-2)', iconBg: 'rgba(145,152,161,0.15)',
    href: '/api/v1/afp/download/installer/mac-arm',
  },
  {
    platform: 'mac', label: 'macOS', sublabel: 'Intel',
    Logo: AppleLogo, iconColor: 'var(--ink-2)', iconBg: 'rgba(145,152,161,0.15)',
    href: '/api/v1/afp/download/installer/mac',
  },
  {
    platform: 'win', label: 'Windows', sublabel: 'x86-64',
    Logo: WindowsLogo, iconColor: 'var(--accent)', iconBg: 'var(--accent-bg)',
    href: '/api/v1/afp/download/installer/win',
  },
];

// CLI sign-in (browser auth) binaries, tucked into the advanced section.
const OS_PLATFORMS = [
  { platform: 'linux',   label: 'Linux',   sublabel: 'x86-64',        Logo: LinuxLogo,   iconColor: 'var(--amber)',  iconBg: 'rgba(210,153,34,0.15)'  },
  { platform: 'mac',     label: 'macOS',   sublabel: 'Intel',         Logo: AppleLogo,   iconColor: 'var(--ink-2)', iconBg: 'rgba(145,152,161,0.15)' },
  { platform: 'mac-arm', label: 'macOS',   sublabel: 'Apple Silicon', Logo: AppleLogo,   iconColor: 'var(--ink-2)', iconBg: 'rgba(145,152,161,0.15)' },
  { platform: 'win',     label: 'Windows', sublabel: 'x86-64',        Logo: WindowsLogo, iconColor: 'var(--accent)', iconBg: 'var(--accent-bg)'      },
];

// ─── Small building blocks ─────────────────────────────────────────────────────
function TrustBadge({ children, icon }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '999px', border: '1px solid var(--line)', background: 'var(--bg-raised)', fontSize: '12px', color: 'var(--ink-2)' }}>
      {icon}
      {children}
    </span>
  );
}

function Collapse({ open, onToggle, icon, label, children }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden' }}>
      <button onClick={onToggle} style={{
        width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          {icon}
          <span style={{ fontSize: '12.5px', color: 'var(--ink-2)' }}>{label}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Goal chooser ──────────────────────────────────────────────────────────────
const GOALS = [
  {
    id: 'chat', title: 'Chat with your data', effort: 'Easiest · nothing to install', tone: 'var(--green)',
    iconBg: 'var(--green-bg)', iconColor: 'var(--green)',
    iconPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    plain: 'Use an AI you already have — ask ChatGPT or Claude about your MyApi data. Authorize once.',
  },
  {
    id: 'computer', title: 'Let an agent use this computer', effort: '~2 min · one download', tone: 'var(--accent)', badge: 'Pro',
    iconBg: 'var(--accent-bg)', iconColor: 'var(--accent)',
    iconPath: 'M3 4h18v13H3zM8 21h8M12 17v4',
    plain: 'Give an AI agent safe, sandboxed access to the files and apps on your machine.',
  },
  {
    id: 'dev', title: 'Connect Agentic AIs', effort: 'For developers', tone: '#a78bfa',
    iconBg: 'rgba(167,139,250,0.15)', iconColor: '#a78bfa',
    iconPath: 'M8 6l-6 6 6 6M16 6l6 6-6 6',
    plain: 'Wire up an MCP agent, a server worker, or your own build — each gets its own key you can revoke anytime.',
  },
];

function GoalCard({ goal, selected, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px',
        padding: '16px', borderRadius: '8px',
        border: `1px solid ${selected || hover ? 'var(--accent)' : 'var(--line)'}`,
        background: selected ? 'var(--accent-bg)' : 'var(--bg-raised)',
        transition: 'border-color 0.12s, background 0.12s', position: 'relative', minHeight: '150px',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ width: '40px', height: '40px', borderRadius: '9px', display: 'grid', placeItems: 'center', background: goal.iconBg, color: goal.iconColor, border: '1px solid var(--line)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={goal.iconPath} /></svg>
        </span>
        {goal.badge && !selected && (
          <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '999px', background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid rgba(56,139,253,0.3)' }}>{goal.badge}</span>
        )}
        {selected && (
          <span style={{ width: '20px', height: '20px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'var(--accent-2)', color: '#fff' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{goal.title}</div>
        <p style={{ margin: '6px 0 0', fontSize: '12.5px', lineHeight: 1.5, color: 'var(--ink-3)' }}>{goal.plain}</p>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: goal.tone }}>
        <span className="tick" style={{ background: goal.tone }} />{goal.effort}
      </span>
    </button>
  );
}

// ─── Detail: CHAT ──────────────────────────────────────────────────────────────
function ChatSection() {
  return (
    <section data-tour="conn-assistants" style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--line)', borderRadius: '10px', background: 'var(--bg-raised)', padding: '22px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Pick an assistant to connect</h3>
        <p style={{ margin: '5px 0 0', fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-3)', maxWidth: '62ch' }}>
          You’ll authorize it once in a browser tab — no keys, tokens, or installs. It can then read what you allow and nothing more.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {ASSISTANTS.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)' }}>
            <span style={{ width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0, display: 'grid', placeItems: 'center', background: a.iconBg, color: a.iconColor, border: '1px solid var(--line)' }}>
              {a.logo}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>{a.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{a.provider}</span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', lineHeight: 1.45, color: 'var(--ink-3)' }}>{a.description}</p>
            </div>
            {a.status === 'available' ? (
              <a href={a.href} target="_blank" rel="noreferrer" className="btn-primary" style={{ flexShrink: 0, textDecoration: 'none', whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
                Connect →
              </a>
            ) : (
              <span style={{ flexShrink: 0, fontSize: '11px', color: 'var(--ink-4)', fontWeight: 500, whiteSpace: 'nowrap', padding: '0 4px' }}>Coming soon</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Detail: COMPUTER (AFP) ────────────────────────────────────────────────────
const COMPUTER_STEPS = [
  { n: '1', title: 'Download & open', body: 'Grab the app for your device below and open it.' },
  { n: '2', title: 'Sign in', body: 'Your browser opens once — log in and click Authorize.' },
  { n: '3', title: 'You’re connected', body: 'It shows a green dot and appears in Your connections.' },
];

function ComputerSection({ onDevicesChanged }) {
  const { user } = useAuthStore();
  const isAfpEnabled = ['pro', 'enterprise'].includes(String(user?.plan || 'free').toLowerCase());
  const [installerAvail, setInstallerAvail]       = useState({});
  const [downloadOAuthInfo, setDownloadOAuthInfo] = useState([]);
  const [downloading, setDownloading]             = useState(null);
  const [advOpen, setAdvOpen]                     = useState(false);
  const [cliOpen, setCliOpen]                     = useState(false);
  const [svcOpen, setSvcOpen]                     = useState(false);
  const [enroll, setEnroll]                       = useState(null);   // { command, commandWindows, code }
  const [enrollBusy, setEnrollBusy]               = useState(false);
  const [enrollError, setEnrollError]             = useState('');

  useEffect(() => {
    if (!isAfpEnabled) return;
    Promise.all([
      apiClient.get('/afp/installer-info').catch(() => ({ data: { platforms: [] } })),
      apiClient.get('/afp/download-oauth-info').catch(() => ({ data: { platforms: [] } })),
    ]).then(([instRes, oauthRes]) => {
      setInstallerAvail(Object.fromEntries((instRes.data?.platforms || []).map(p => [p.platform, p.available])));
      setDownloadOAuthInfo(oauthRes.data?.platforms || []);
    });
  }, [isAfpEnabled]);

  async function generateEnrollCommand() {
    setEnrollBusy(true); setEnrollError('');
    try {
      const res = await apiClient.post('/afp/enroll-code');
      const d = res.data || {};
      setEnroll({
        command: d.commandUnix || d.command,
        commandWindows: d.commandWindows || null,
        code: d.code,
      });
      onDevicesChanged?.();
    } catch (e) {
      setEnrollError(e?.response?.data?.error || 'Failed to generate install command');
    } finally { setEnrollBusy(false); }
  }

  async function handleOAuthDownload(platform) {
    setDownloading(platform);
    try {
      const response = await fetch(`/api/v1/afp/download-oauth/${platform}`, { credentials: 'include' });
      if (!response.ok) { const err = await response.json().catch(() => ({})); alert(err.error || 'Download failed.'); return; }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = response.headers.get('Content-Disposition') || '';
      const nameMatch = cd.match(/filename="?([^"]+)"?/);
      a.href = blobUrl; a.download = nameMatch ? nameMatch[1] : `afp-oauth-${platform}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } finally { setDownloading(null); }
  }

  if (!isAfpEnabled) {
    return (
      <section style={{ borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--bg-raised)', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--amber)', marginBottom: '8px' }}>Pro &amp; Heavy only</p>
        <p style={{ fontSize: '13px', color: 'var(--ink-2)', maxWidth: '360px', margin: '0 auto 16px' }}>AFP connectors let AI agents access your local files and shell. Upgrade to unlock.</p>
        <a href="/dashboard/settings?section=billing" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>Upgrade Plan</a>
      </section>
    );
  }

  return (
    <section data-tour="conn-install" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--line)', borderRadius: '10px', background: 'var(--bg-raised)', padding: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div className="micro" style={{ marginBottom: '6px' }}>AFP · AGENT FILE PROTOCOL</div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Install the AFP connector on your computer</h3>
          <p style={{ margin: '5px 0 0', fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-3)', maxWidth: '62ch' }}>
            AFP — the Agent File Protocol — runs quietly in your menu bar or tray and gives agents sandboxed access
            to your files, only when you say so. Three steps, about two minutes.
          </p>
        </div>
        <span style={{ flexShrink: 0, fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '999px', background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid rgba(56,139,253,0.3)' }}>Pro</span>
      </div>

      {/* Steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {COMPUTER_STEPS.map(s => (
          <div key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)' }}>
            <span className="mono" style={{ width: '24px', height: '24px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: '12px', fontWeight: 700 }}>{s.n}</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{s.title}</div>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.45, color: 'var(--ink-3)' }}>{s.body}</p>
          </div>
        ))}
      </div>

      {/* Download tiles */}
      <div>
        <div className="micro" style={{ marginBottom: '8px' }}>Download for your device</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          {DESKTOP_PLATFORMS.map(os => {
            const ready = installerAvail[os.platform] === true;
            const inner = (
              <>
                <span style={{ width: '32px', height: '32px', borderRadius: '7px', flexShrink: 0, display: 'grid', placeItems: 'center', background: os.iconBg, color: os.iconColor, border: '1px solid var(--line)' }}>
                  <os.Logo style={{ width: '16px', height: '16px' }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: ready ? 'var(--ink)' : 'var(--ink-2)' }}>{os.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{os.sublabel}</div>
                </div>
                {ready ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 12l5 5 5-5" /><path d="M5 21h14" /></svg>
                ) : (
                  <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '999px', background: 'var(--bg-hover)', border: '1px solid var(--line)', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>Coming soon</span>
                )}
              </>
            );
            const tileStyle = {
              display: 'flex', alignItems: 'center', gap: '11px', padding: '13px 14px', borderRadius: '8px',
              border: '1px solid var(--line)', background: 'var(--bg)', textAlign: 'left',
              transition: 'border-color 0.12s, background 0.12s', textDecoration: 'none',
            };
            return ready ? (
              <a key={`${os.platform}`} href={os.href} style={tileStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--bg)'; }}>
                {inner}
              </a>
            ) : (
              <div key={`${os.platform}`} style={{ ...tileStyle, opacity: 0.45, cursor: 'not-allowed' }}>{inner}</div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', borderRadius: '6px', border: '1px solid rgba(210,153,34,0.25)', background: 'rgba(210,153,34,0.08)', padding: '10px 12px', marginTop: '8px' }}>
          <svg style={{ width: '14px', height: '14px', color: 'var(--amber)', marginTop: '1px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          <p style={{ fontSize: '11px', color: 'var(--amber)', lineHeight: 1.5 }}>
            Unsigned build — Windows: click "More info" → "Run anyway" in SmartScreen. On macOS, right-click the app → Open the first time.
          </p>
        </div>
      </div>

      {/* Advanced */}
      <Collapse open={advOpen} onToggle={() => setAdvOpen(o => !o)}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-6-6-6" /><path d="M12 19h8" /></svg>}
        label="Running a server or headless machine? Advanced install options">
        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: 'var(--ink-3)' }}>
          Prefer the command line? Generate a one-line installer for any Linux, macOS, or Windows machine — it
          enrolls and installs an auto-starting service. The single-use code expires in 15 minutes; your account
          token never leaves your machine.
        </p>
        {!enroll ? (
          <button onClick={generateEnrollCommand} disabled={enrollBusy} className="ui-button-primary" style={{ width: 'fit-content', fontSize: '12px' }}>
            {enrollBusy ? 'Generating…' : 'Generate install command'}
          </button>
        ) : (
          <>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', margin: '0 0 -4px' }}>Linux / macOS</p>
            <CopyBlock accent="green" label="bash · run on the target machine" text={enroll.command} />
            {enroll.commandWindows && (
              <>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', margin: '4px 0 -4px' }}>Windows</p>
                <CopyBlock accent="blue" label="PowerShell (run as Administrator)" text={enroll.commandWindows} />
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '11px', color: 'var(--ink-4)' }}>
                Same code works on either OS · single-use · expires in 15 minutes · the machine appears in Your connections when done.
              </p>
              <button onClick={generateEnrollCommand} disabled={enrollBusy} className="btn" style={{ fontSize: '11px', padding: '3px 10px' }}>
                {enrollBusy ? '…' : 'New code'}
              </button>
            </div>
          </>
        )}
        {enrollError && <p style={{ fontSize: '12px', color: 'var(--red)' }}>{enrollError}</p>}

        {/* CLI browser sign-in binaries */}
        <Collapse open={cliOpen} onToggle={() => setCliOpen(o => !o)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>}
          label="CLI browser sign-in — standalone binaries">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            {OS_PLATFORMS.map(os => {
              const info = downloadOAuthInfo.find(p => p.platform === os.platform);
              const size = info?.available ? fmtBytes(info.size) : null;
              const isLoading = downloading === os.platform;
              return (
                <button key={os.platform} onClick={() => handleOAuthDownload(os.platform)} disabled={!!downloading} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  padding: '14px', borderRadius: '8px',
                  background: 'var(--bg)', border: '1px solid var(--line)',
                  cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? 0.5 : 1,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { if (!downloading) { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--bg)'; }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '7px', display: 'grid', placeItems: 'center', background: os.iconBg, color: os.iconColor, border: '1px solid var(--line)' }}>
                    {isLoading
                      ? <svg style={{ width: '16px', height: '16px', color: 'var(--ink-3)' }} className="animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      : <os.Logo style={{ width: '16px', height: '16px' }} />}
                  </span>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{os.label}</p>
                    <p style={{ fontSize: '10px', color: 'var(--ink-3)' }}>{os.sublabel}</p>
                    {size && <p style={{ fontSize: '10px', color: 'var(--ink-4)', marginTop: '2px' }}>{size}</p>}
                  </div>
                </button>
              );
            })}
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--ink-4)', lineHeight: 1.5 }}>
            Run the binary from a terminal — your browser opens once to authorize, then the daemon stays connected in the background.
          </p>
        </Collapse>

        {/* systemd service management */}
        <Collapse open={svcOpen} onToggle={() => setSvcOpen(o => !o)}
          icon={<LinuxLogo style={{ width: '14px', height: '14px', color: 'var(--amber)' }} />}
          label="Linux — service management & uninstall">
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>Enable / Disable auto-start</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <CopyBlock accent="blue" label="enable" text="sudo systemctl enable myapi-afp && sudo systemctl start myapi-afp" />
              <CopyBlock accent="blue" label="disable" text="sudo systemctl disable myapi-afp && sudo systemctl stop myapi-afp" />
            </div>
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>Uninstall</p>
            <CopyBlock accent="blue" label="bash" text={`sudo systemctl stop myapi-afp
sudo systemctl disable myapi-afp
sudo rm /etc/systemd/system/myapi-afp.service
sudo rm /usr/local/bin/myapi-afp
sudo systemctl daemon-reload`} />
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '8px' }}>Your credentials at <span className="mono" style={{ color: 'var(--ink-2)' }}>~/.myapi/</span> are not deleted.</p>
          </div>
        </Collapse>
      </Collapse>
    </section>
  );
}

// ─── Detail: DEV ───────────────────────────────────────────────────────────────
const DEV_METHODS = [
  {
    id: 'keypair', title: 'Signed keypair', badge: 'Most control',
    badgeBg: 'rgba(167,139,250,0.15)', badgeColor: '#a78bfa', badgeBorder: 'rgba(167,139,250,0.4)',
    desc: 'A local daemon signs every request with an Ed25519 key that never leaves the machine.',
    bestFor: 'Production pipelines & untended servers',
  },
  {
    id: 'oauth', title: 'OAuth PKCE', badge: 'Browser sign-in',
    badgeBg: 'var(--accent-bg)', badgeColor: 'var(--accent)', badgeBorder: 'rgba(56,139,253,0.4)',
    desc: 'Run a one-line installer; your browser authorizes once, then a per-agent token is printed.',
    bestFor: 'Interactive setups with a human present',
  },
  {
    id: 'master', title: 'Master token', badge: 'Quickest test',
    badgeBg: 'rgba(210,153,34,0.15)', badgeColor: 'var(--amber)', badgeBorder: 'rgba(210,153,34,0.4)',
    desc: 'Paste an existing token straight into the agent. Works instantly with any HTTP client.',
    bestFor: 'Quick local experiments only',
  },
];

function DevSection({ initialMethod }) {
  const [advOpen, setAdvOpen] = useState(!!initialMethod);
  const [method, setMethod] = useState(initialMethod || 'keypair');
  const [tableOpen, setTableOpen] = useState(false);

  return (
    <section data-tour="conn-agents" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--line)', borderRadius: '10px', background: 'var(--bg-raised)', padding: '22px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Give your agent its own key</h3>
        <p style={{ margin: '5px 0 0', fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-3)', maxWidth: '62ch' }}>
          For scripts, servers, and coding agents. Each one gets its own scoped identity — so you can see what it
          did and shut it off on its own, without touching anything else.
        </p>
      </div>

      {/* Recommended: Quick Connect */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px', borderRadius: '8px', border: '1px solid var(--accent)', background: 'var(--accent-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '999px', background: 'var(--accent-2)', color: '#fff' }}>Recommended</span>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>Quick Connect</span>
          <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>One MCP prompt · no token ever shared</span>
        </div>
        <QuickConnectPanel />
      </div>

      {/* Advanced compare */}
      <Collapse open={advOpen} onToggle={() => setAdvOpen(o => !o)}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></svg>}
        label="Need more control? Compare all connection methods">
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink-4)' }}>Pick a method to set it up — you’re not just comparing, this is where you connect.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          {DEV_METHODS.map(m => {
            const sel = m.id === method;
            return (
              <button key={m.id} onClick={() => setMethod(m.id)} style={{
                textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '9px',
                padding: '14px', borderRadius: '8px',
                border: `1px solid ${sel ? 'var(--accent)' : 'var(--line)'}`,
                background: sel ? 'var(--accent-bg)' : 'var(--bg)',
                transition: 'border-color 0.12s, background 0.12s', position: 'relative',
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--line)'; }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '999px', background: m.badgeBg, color: m.badgeColor, border: `1px solid ${m.badgeBorder}` }}>{m.badge}</span>
                  {sel && (
                    <span style={{ width: '18px', height: '18px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'var(--accent-2)', color: '#fff' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{m.title}</div>
                <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.45, color: 'var(--ink-3)' }}>{m.desc}</p>
                <div style={{ marginTop: '2px', paddingTop: '9px', borderTop: '1px solid var(--line)' }}>
                  <div className="micro" style={{ marginBottom: '3px' }}>Best for</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--ink-2)', lineHeight: 1.4 }}>{m.bestFor}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)' }}>
          {method === 'keypair' && <AscKeypairPanel />}
          {method === 'oauth'   && <OAuthInstallerPanel />}
          {method === 'master'  && <MasterTokenPanel />}
        </div>

        <Collapse open={tableOpen} onToggle={() => setTableOpen(o => !o)}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /><rect x="3" y="3" width="18" height="18" rx="2" /></svg>}
          label="Full comparison table">
          <CompareMethodsPanel />
        </Collapse>
      </Collapse>
    </section>
  );
}

// ─── Your connections ──────────────────────────────────────────────────────────
function ConnectionRow({ conn, onRevoke }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg-raised)' }}>
      <span style={{ width: '32px', height: '32px', borderRadius: '7px', flexShrink: 0, display: 'grid', placeItems: 'center', background: conn.iconBg, color: conn.iconColor, border: '1px solid var(--line)' }}>
        {conn.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{conn.name}</span>
          <span style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{conn.meta}</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginTop: '1px' }}>{conn.kind}</div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', fontWeight: 500, padding: '3px 9px', borderRadius: '999px', background: conn.online ? 'var(--green-bg)' : 'var(--bg-hover)', color: conn.online ? 'var(--green)' : 'var(--ink-3)' }}>
        <span className="tick" style={{ background: conn.online ? 'var(--green)' : 'var(--ink-4)' }} />
        {conn.online ? 'Online' : 'Idle'}
      </span>
      {confirming ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button onClick={() => { onRevoke(conn); setConfirming(false); }} className="ui-button-danger" style={{ fontSize: '11px', padding: '4px 10px' }}>Revoke</button>
          <button onClick={() => setConfirming(false)} className="btn" style={{ fontSize: '11px', padding: '4px 10px' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} title="Revoke" style={{
          width: '28px', height: '28px', borderRadius: '6px', display: 'grid', placeItems: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', flexShrink: 0,
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent'; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}

const AGENT_KEY_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6l-6 6 6 6M16 6l6 6-6 6" /></svg>
);

function ConnectionsSection({ refreshKey }) {
  const { user } = useAuthStore();
  const isAfpEnabled = ['pro', 'enterprise'].includes(String(user?.plan || 'free').toLowerCase());
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [afpRes, ascRes] = await Promise.all([
        isAfpEnabled ? apiClient.get('/afp/devices').catch(() => null) : Promise.resolve(null),
        apiClient.get('/devices/approved').catch(() => null),
      ]);
      if (cancelled) return;
      const list = [];
      for (const d of afpRes?.data?.devices || []) {
        const pm = getPlatformMeta(d.platform);
        list.push({
          id: `afp-${d.id}`, type: 'afp', deviceId: d.id,
          name: d.name, meta: `${pm.label} · ${d.arch || ''}`.replace(/ · $/, ''),
          kind: d.privileges === 'full' ? 'This computer · AFP · full access' : 'This computer · AFP · restricted',
          online: d.status === 'online',
          icon: pm.Logo ? <pm.Logo style={{ width: '16px', height: '16px' }} /> : AGENT_KEY_ICON,
          iconBg: pm.iconBg, iconColor: pm.iconColor,
          lastSeen: d.lastSeenAt,
        });
      }
      for (const d of ascRes?.data?.devices || []) {
        const info = d.info || {};
        if (info.type !== 'asc' && info.enrolledVia !== 'quick_connect') continue;
        const scoped = d.scope && d.scope !== 'full';
        list.push({
          id: `asc-${d.id}`, type: 'asc', deviceId: d.id,
          name: d.name || 'AI Agent',
          meta: info.enrolledVia === 'quick_connect' ? 'Quick Connect' : 'Signed keypair',
          kind: scoped ? 'Coding agent · scoped key · Ed25519' : 'Coding agent · full access · Ed25519',
          online: d.lastUsedAt ? (Date.now() - new Date(d.lastUsedAt).getTime()) < 5 * 60 * 1000 : false,
          icon: AGENT_KEY_ICON,
          iconBg: 'rgba(167,139,250,0.15)', iconColor: '#a78bfa',
          lastSeen: d.lastUsedAt,
        });
      }
      setConnections(list);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [isAfpEnabled, refreshKey]);

  async function revoke(conn) {
    try {
      if (conn.type === 'afp') await apiClient.delete(`/afp/devices/${conn.deviceId}`);
      else await apiClient.post(`/devices/${conn.deviceId}/revoke`);
      setConnections(cs => cs.filter(c => c.id !== conn.id));
    } catch {
      alert('Failed to revoke');
    }
  }

  const onlineCount = connections.filter(c => c.online).length;

  return (
    <section data-tour="conn-connections" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Your connections</h2>
        {onlineCount > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--green)' }}>
            <span className="tick" style={{ background: 'var(--green)', animation: 'conn-pulse 1.6s ease-in-out infinite' }} />
            {onlineCount} online
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {connections.map(conn => <ConnectionRow key={conn.id} conn={conn} onRevoke={revoke} />)}
        {!loading && connections.length === 0 && (
          <div style={{ textAlign: 'center', padding: '22px', border: '1px dashed var(--line)', borderRadius: '8px', fontSize: '12.5px', color: 'var(--ink-4)' }}>
            Nothing connected yet. Pick a path above to get started.
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function Connectors() {
  // Deep links: #asc / #keypair / #quick / #dev open the developer path,
  // #afp / #computer the computer path (AccessTokens links to /connectors#asc).
  const hash = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '');
  const initialGoal = ['asc', 'keypair', 'quick', 'dev', 'oauth', 'master'].includes(hash) ? 'dev'
    : ['afp', 'computer'].includes(hash) ? 'computer'
    : 'chat';
  const initialMethod = ['asc', 'keypair'].includes(hash) ? 'keypair'
    : hash === 'oauth' ? 'oauth'
    : hash === 'master' ? 'master'
    : null;
  const [goal, setGoal] = useState(initialGoal);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="ui-page" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <style>{'@keyframes conn-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }'}</style>

      {/* ─── Hero ─── */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <div className="micro" style={{ marginBottom: '10px' }}>GATEWAY</div>
          <h1 className="font-serif" style={{ fontSize: '32px', lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', fontWeight: 500, margin: 0 }}>Connect an AI to your world.</h1>
          <p style={{ margin: '10px 0 0', fontSize: '15px', lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: '56ch' }}>
            Give an assistant or agent secure access to your apps, files, and data — in a couple of clicks.
            Pick what you want to connect and we’ll walk you through it.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <TrustBadge icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 11h12v9H6z" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>}>
            Your credentials are never shared
          </TrustBadge>
          <TrustBadge icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>}>
            Scoped, least-privilege access
          </TrustBadge>
          <TrustBadge icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>}>
            Revoke anytime, instantly
          </TrustBadge>
        </div>
      </header>

      {/* ─── Chooser ─── */}
      <section data-tour="conn-goals" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>What do you want to connect?</h2>
          <span style={{ fontSize: '12px', color: 'var(--ink-4)' }}>Not sure? Start with the first one.</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {GOALS.map(g => <GoalCard key={g.id} goal={g} selected={g.id === goal} onClick={() => setGoal(g.id)} />)}
        </div>
      </section>

      {/* ─── Detail ─── */}
      {goal === 'chat' && <ChatSection />}
      {goal === 'computer' && <ComputerSection onDevicesChanged={() => setRefreshKey(k => k + 1)} />}
      {goal === 'dev' && <DevSection initialMethod={initialMethod} />}

      {/* ─── Manage ─── */}
      <ConnectionsSection refreshKey={refreshKey} />
    </div>
  );
}
