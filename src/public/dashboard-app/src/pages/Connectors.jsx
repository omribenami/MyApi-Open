import { useEffect, useState, useCallback } from 'react';
import apiClient from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';

// ─── CopyBlock ─────────────────────────────────────────────────────────────────
function CopyBlock({ text, label, accent = 'blue' }) {
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
      <pre className="mono" style={{ fontSize: '11px', color: 'var(--ink-2)', padding: '12px', overflowX: 'auto', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><code>{text}</code></pre>
    </div>
  );
}

// ─── Data ──────────────────────────────────────────────────────────────────────
const CONNECTORS = [
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

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getPlatformMeta(platform) {
  switch (platform) {
    case 'linux':  return { label: 'Linux',   Logo: LinuxLogo,   iconColor: 'var(--amber)',  iconBg: 'rgba(210,153,34,0.15)'  };
    case 'darwin': return { label: 'macOS',   Logo: AppleLogo,   iconColor: 'var(--ink-2)',  iconBg: 'rgba(145,152,161,0.15)' };
    case 'win32':  return { label: 'Windows', Logo: WindowsLogo, iconColor: 'var(--accent)', iconBg: 'var(--accent-bg)'       };
    default:       return { label: platform || 'Unknown', Logo: null, iconColor: 'var(--ink-3)', iconBg: 'rgba(110,118,129,0.15)' };
  }
}

function fmtRelTime(isoStr) {
  if (!isoStr) return 'never';
  const s = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtBytes(bytes) {
  if (!bytes) return '';
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

// ─── DeviceRow ─────────────────────────────────────────────────────────────────
function DeviceRow({ device, onRevoke }) {
  const [confirming, setConfirming] = useState(false);
  const pm = getPlatformMeta(device.platform);
  const isOnline = device.status === 'online';

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '12px',
      paddingLeft: '20px', paddingRight: '16px', paddingTop: '12px', paddingBottom: '12px',
      borderRadius: '6px',
      border: `1px solid ${isOnline ? 'rgba(63,185,80,0.25)' : 'var(--line)'}`,
      background: isOnline ? 'rgba(46,160,67,0.08)' : 'var(--bg-raised)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', borderRadius: '6px 0 0 6px',
        background: isOnline ? 'var(--green)' : 'transparent', opacity: 0.6,
      }} />
      <div style={{
        width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0,
        background: pm.iconBg, border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {pm.Logo
          ? <pm.Logo style={{ width: '16px', height: '16px', color: pm.iconColor }} />
          : <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{(device.platform || '?')[0].toUpperCase()}</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.name}</span>
          <span style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{device.hostname}</span>
          <span style={{
            fontSize: '10px', padding: '1px 6px', borderRadius: '999px',
            border: '1px solid',
            fontWeight: 500,
            ...(device.privileges === 'full'
              ? { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }
              : { background: 'rgba(210,153,34,0.15)', color: 'var(--amber)', borderColor: 'rgba(210,153,34,0.3)' }
            ),
          }}>
            {device.privileges === 'full' ? 'Full access' : 'Restricted'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{pm.label} · {device.arch}</span>
          <span style={{ fontSize: '11px', color: 'var(--ink-4)' }}>Last seen {fmtRelTime(device.lastSeenAt)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '10px', padding: '3px 8px', borderRadius: '999px', fontWeight: 500,
          background: isOnline ? 'var(--green-bg)' : 'var(--bg-hover)',
          color: isOnline ? 'var(--green)' : 'var(--ink-3)',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? 'var(--green)' : 'var(--ink-4)' }} />
          {device.status}
        </span>
        {confirming ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={() => { onRevoke(device.id); setConfirming(false); }} className="ui-button-danger" style={{ fontSize: '11px', padding: '4px 10px' }}>Confirm</button>
            <button onClick={() => setConfirming(false)} className="btn" style={{ fontSize: '11px', padding: '4px 10px' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} style={{
            width: '28px', height: '28px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-4)', transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent'; }}>
            <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── OS platform configs ───────────────────────────────────────────────────────
const OS_PLATFORMS = [
  { platform: 'linux',   label: 'Linux',   sublabel: 'x86-64',       Logo: LinuxLogo,   iconColor: 'var(--amber)',  iconBg: 'rgba(210,153,34,0.15)'  },
  { platform: 'mac',     label: 'macOS',   sublabel: 'Intel',         Logo: AppleLogo,   iconColor: 'var(--ink-2)', iconBg: 'rgba(145,152,161,0.15)' },
  { platform: 'mac-arm', label: 'macOS',   sublabel: 'Apple Silicon', Logo: AppleLogo,   iconColor: 'var(--ink-2)', iconBg: 'rgba(145,152,161,0.15)' },
  { platform: 'win',     label: 'Windows', sublabel: 'x86-64',        Logo: WindowsLogo, iconColor: 'var(--accent)', iconBg: 'var(--accent-bg)'      },
];

const DESKTOP_PLATFORMS = [
  {
    platform: 'win', label: 'Windows', sublabel: 'x86-64',
    Logo: WindowsLogo, iconColor: 'var(--accent)', iconBg: 'var(--accent-bg)',
    href: '/api/v1/afp/download/installer/win', filename: 'MyApi-AFP-win-x64.exe',
  },
  {
    platform: 'mac-arm', label: 'macOS', sublabel: 'Apple Silicon',
    Logo: AppleLogo, iconColor: 'var(--ink-4)', iconBg: 'rgba(145,152,161,0.07)',
    comingSoon: true,
  },
  {
    platform: 'mac', label: 'macOS', sublabel: 'Intel',
    Logo: AppleLogo, iconColor: 'var(--ink-4)', iconBg: 'rgba(145,152,161,0.07)',
    comingSoon: true,
  },
];

// ─── AfpConnectorCard ──────────────────────────────────────────────────────────
function AfpConnectorCard() {
  const { user } = useAuthStore();
  const isAfpEnabled = ['pro', 'enterprise'].includes(String(user?.plan || 'free').toLowerCase());
  const [devices, setDevices]                     = useState([]);
  const [downloadInfo, setDownloadInfo]           = useState([]);
  const [downloadOAuthInfo, setDownloadOAuthInfo] = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [downloading, setDownloading]             = useState(null);
  const [edition, setEdition]                     = useState('desktop');
  const [installOpen, setInstallOpen]             = useState(false);
  const [linuxOpen, setLinuxOpen]                 = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get('/afp/devices').catch(() => ({ data: { devices: [] } })),
      apiClient.get('/afp/download-info').catch(() => ({ data: { platforms: [] } })),
      apiClient.get('/afp/download-oauth-info').catch(() => ({ data: { platforms: [] } })),
    ]).then(([devRes, dlRes, oauthRes]) => {
      setDevices(devRes.data?.devices || []);
      setDownloadInfo(dlRes.data?.platforms || []);
      setDownloadOAuthInfo(oauthRes.data?.platforms || []);
    }).finally(() => setLoading(false));
  }, []);

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const totalCount  = devices.length;

  function getSize(info, platform) {
    const found = info.find(p => p.platform === platform);
    return found?.available ? fmtBytes(found.size) : null;
  }

  async function handleDownload(type, platform) {
    const key = `${type}-${platform}`;
    setDownloading(key);
    const url = type === 'oauth' ? `/api/v1/afp/download-oauth/${platform}` : `/api/v1/afp/download/${platform}`;
    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) { const err = await response.json().catch(() => ({})); alert(err.error || 'Download failed.'); return; }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = response.headers.get('Content-Disposition') || '';
      const nameMatch = cd.match(/filename="?([^"]+)"?/);
      a.href = blobUrl; a.download = nameMatch ? nameMatch[1] : `afp-${type}-${platform}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } finally { setDownloading(null); }
  }

  const installSteps = {
    oauth: [
      { title: 'Download', body: 'Pick your OS below and save the file. No dependencies required.' },
      { title: 'Run it', body: 'Double-click (Windows) or run from terminal (Mac/Linux). Your browser opens automatically.' },
      { title: 'Sign in', body: 'Log in and click Authorize. The daemon connects and stays running in the background.' },
      { title: 'Done', body: 'Your PC appears in Connected Devices below.' },
    ],
    daemon: [
      { title: 'Download', body: 'Pick your OS and save the file.' },
      { title: 'Run it', body: 'Double-click (Windows) or run from terminal. A wizard asks for your server URL and API token.' },
      { title: 'Auto-start', body: 'The wizard can install it as a background service.' },
      { title: 'Done', body: 'Your PC appears in Connected Devices below.' },
    ],
    desktop: [
      { title: 'Download', body: 'Pick your platform. macOS: open the DMG and drag to Applications. Windows: run the installer.' },
      { title: 'First launch', body: 'The app icon appears in your menu bar (Mac) or system tray (Windows) and your browser opens to sign in.' },
      { title: 'Authorize', body: 'Log in and click Authorize. The app connects and shows a green dot when ready.' },
      { title: 'Done', body: 'Your device appears in Connected Devices below.' },
    ],
  };

  if (!isAfpEnabled) {
    return (
      <div style={{ borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg-raised)', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--amber)', marginBottom: '8px' }}>Pro &amp; Enterprise only</p>
        <p style={{ fontSize: '13px', color: 'var(--ink-2)', maxWidth: '360px', margin: '0 auto 16px' }}>AFP connectors let AI agents access your local files and shell. Upgrade to unlock.</p>
        <a href="/dashboard/settings?section=billing" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>Upgrade Plan</a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Edition toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px', background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '6px', width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          { id: 'desktop', label: 'Desktop App',  badge: 'New',         badgeStyle: { background: 'var(--green-bg)', color: 'var(--green)' } },
          { id: 'oauth',   label: 'CLI Sign-in',  badge: 'Recommended', badgeStyle: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa' } },
          { id: 'daemon',  label: 'CLI Token',    badge: 'Self-hosted', badgeStyle: { background: 'var(--bg-hover)', color: 'var(--ink-3)' } },
        ].map(e => (
          <button key={e.id} onClick={() => setEdition(e.id)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '4px',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: 'none',
            background: edition === e.id ? 'var(--bg-hover)' : 'transparent',
            color: edition === e.id ? 'var(--ink)' : 'var(--ink-3)',
            transition: 'background 0.15s, color 0.15s',
          }}>
            {e.label}
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', fontWeight: 600, ...e.badgeStyle }}>{e.badge}</span>
          </button>
        ))}
      </div>

      {/* Download grid */}
      {edition === 'desktop' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {DESKTOP_PLATFORMS.map(os =>
              os.comingSoon ? (
                <div key={os.platform} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  padding: '16px', borderRadius: '6px',
                  background: 'var(--bg-raised)', border: '1px solid var(--line)',
                  opacity: 0.4, cursor: 'not-allowed',
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: os.iconBg, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <os.Logo style={{ width: '16px', height: '16px', color: os.iconColor }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink-2)' }}>{os.label}</p>
                    <p style={{ fontSize: '10px', color: 'var(--ink-4)' }}>{os.sublabel}</p>
                  </div>
                  <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '999px', background: 'var(--bg-hover)', border: '1px solid var(--line)', color: 'var(--ink-3)', fontWeight: 500 }}>Coming soon</span>
                </div>
              ) : (
                <a key={os.platform} href={os.href} download={os.filename} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  padding: '16px', borderRadius: '6px',
                  background: 'var(--bg-raised)', border: '1px solid var(--line)',
                  textDecoration: 'none', transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: os.iconBg, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <os.Logo style={{ width: '16px', height: '16px', color: os.iconColor }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{os.label}</p>
                    <p style={{ fontSize: '10px', color: 'var(--ink-3)' }}>{os.sublabel}</p>
                  </div>
                  <svg style={{ width: '14px', height: '14px', color: 'var(--ink-4)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </a>
              )
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', borderRadius: '6px', border: '1px solid rgba(210,153,34,0.25)', background: 'rgba(210,153,34,0.08)', padding: '10px 12px' }}>
            <svg style={{ width: '14px', height: '14px', color: 'var(--amber)', marginTop: '1px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            <p style={{ fontSize: '11px', color: 'var(--amber)', lineHeight: '1.5' }}>
              Unsigned build — Windows: click "More info" → "Run anyway" in SmartScreen. macOS coming soon.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {OS_PLATFORMS.map(os => {
            const info = edition === 'oauth' ? downloadOAuthInfo : downloadInfo;
            const size = getSize(info, os.platform);
            const key  = `${edition}-${os.platform}`;
            const isLoading = downloading === key;
            return (
              <button key={os.platform} onClick={() => handleDownload(edition, os.platform)} disabled={!!downloading} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                padding: '16px', borderRadius: '6px',
                background: 'var(--bg-raised)', border: '1px solid var(--line)',
                cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? 0.5 : 1,
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { if (!downloading) { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: os.iconBg, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isLoading
                    ? <svg style={{ width: '16px', height: '16px', color: 'var(--ink-3)' }} className="animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    : <os.Logo style={{ width: '16px', height: '16px', color: os.iconColor }} />
                  }
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{os.label}</p>
                  <p style={{ fontSize: '10px', color: 'var(--ink-3)' }}>{os.sublabel}</p>
                  {size && <p style={{ fontSize: '10px', color: 'var(--ink-4)', marginTop: '2px' }}>{size}</p>}
                </div>
                {!isLoading && <svg style={{ width: '14px', height: '14px', color: 'var(--ink-4)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
              </button>
            );
          })}
        </div>
      )}

      {/* How to install */}
      <div style={{ borderRadius: '6px', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <button onClick={() => setInstallOpen(o => !o)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span className="micro" style={{ color: 'var(--ink-3)' }}>How to install</span>
          <svg style={{ width: '16px', height: '16px', color: 'var(--ink-4)', transform: installOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {installOpen && (
          <div style={{ padding: '12px 16px 20px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {installSteps[edition].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px' }}>
                <span style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'var(--bg-hover)', border: '1px solid var(--line)',
                  color: 'var(--ink-3)', fontSize: '11px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                }}>{i + 1}</span>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{s.title}</p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '2px', lineHeight: '1.5' }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linux service management */}
      {edition !== 'desktop' && (
        <div style={{ borderRadius: '6px', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <button onClick={() => setLinuxOpen(o => !o)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LinuxLogo style={{ width: '14px', height: '14px', color: 'var(--amber)' }} />
              <span className="micro" style={{ color: 'var(--ink-3)' }}>Linux — Service Management</span>
            </div>
            <svg style={{ width: '16px', height: '16px', color: 'var(--ink-4)', transform: linuxOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {linuxOpen && (
            <div style={{ padding: '12px 16px 20px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>Install as a systemd service</p>
                <CopyBlock accent="blue" label="bash" text={`sudo mv ./afp-oauth-linux /usr/local/bin/myapi-afp
sudo chmod +x /usr/local/bin/myapi-afp

sudo tee /etc/systemd/system/myapi-afp.service > /dev/null <<EOF
[Unit]
Description=MyApi AFP Connector
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/myapi-afp
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now myapi-afp`} />
              </div>
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
            </div>
          )}
        </div>
      )}

      {/* Connected devices */}
      {!loading && totalCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="micro" style={{ color: 'var(--ink-4)' }}>Connected Devices · {totalCount}</p>
            {onlineCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--green)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)' }} />{onlineCount} online
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {devices.map(device => (
              <DeviceRow key={device.id} device={device}
                onRevoke={id => apiClient.delete(`/afp/devices/${id}`).then(() => setDevices(ds => ds.filter(d => d.id !== id))).catch(() => alert('Failed to revoke'))} />
            ))}
          </div>
        </div>
      )}
      {!loading && totalCount === 0 && (
        <p style={{ fontSize: '12px', color: 'var(--ink-4)', textAlign: 'center', padding: '16px 0' }}>No devices connected yet. Download and run the app above to get started.</p>
      )}
    </div>
  );
}

// ─── Step ──────────────────────────────────────────────────────────────────────
function Step({ n, title, children }) {
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

// ─── OAuthInstallerPanel ───────────────────────────────────────────────────────
function OAuthInstallerPanel() {
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
        <CopyBlock label="agent prompt" accent="blue" text={`I ran the MyApi agent auth installer on my machine and got this access token:

myapi_PASTE_TOKEN_HERE

Please save this as your MyApi Bearer token and use it for all API requests:
  Authorization: Bearer myapi_PASTE_TOKEN_HERE
  Base URL: https://www.myapiai.com/api/v1/

Do not ask me to run the installer — I already ran it. Just use this token.`} />
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

// ─── AscKeypairPanel ───────────────────────────────────────────────────────────
function AscKeypairPanel() {
  return (
    <div>
      <Step n="1" title="Send this prompt to your agent">
        <CopyBlock label="agent prompt" accent="violet" text={`Please set up an ASC (Agentic Secure Connection) to my MyApi account so you have a stable cryptographic identity across sessions and IPs.

── SETUP (one time) ──────────────────────────────────────────

1. Generate an Ed25519 keypair and extract the raw 32-byte public key:
   const { generateKeyPairSync } = require('crypto');
   const { privateKey, publicKey } = generateKeyPairSync('ed25519');
   const pubKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('base64');
   Save privateKey and pubKeyB64 to disk before continuing — never keep them only in memory.

2. Fetch your token ID — you'll need it for signing:
   GET https://www.myapiai.com/api/v1/auth/me
   Authorization: Bearer <your-token>
   → Save the value at bootstrap.tokenId (format: tok_xxxxxxxx...)
   This ID is fixed for your token. Fetch it once on startup, not on every request.

3. Register your public key:
   POST https://www.myapiai.com/api/v1/agentic/asc/register
   Authorization: Bearer <your-token>
   Content-Type: application/json
   Body: {"public_key":"<pubKeyB64>","label":"<your-agent-name>"}
   Show me the key_fingerprint from the response — I need to approve it.

── SIGNING (every request after approval) ────────────────────

Add these 3 headers to every API request:
  X-Agent-PublicKey:  <pubKeyB64>
  X-Agent-Timestamp:  <current Unix seconds as string>
  X-Agent-Signature:  base64( Ed25519_sign(privateKey, Buffer.from(timestamp + ":" + tokenId)) )

Keep Authorization: Bearer <your-token> as well.

── COMMON MISTAKES ───────────────────────────────────────────

✗ tokenId is NOT the token secret (myapi_...), NOT the hash, NOT the fingerprint
✓ tokenId looks like: tok_a44fbb8effb427b4bd51f32606e5d4f2

✗ Do NOT regenerate the keypair on each session — load it from disk
✓ Persist privateKey and pubKeyB64 to ~/.myapi-asc.key (or equivalent)

✗ Do NOT hardcode tokenId — fetch it via /auth/me on startup
✓ tokenId stays the same as long as the token is not revoked`} />
      </Step>

      <Step n="2" title="Approve the key">
        <p style={{ fontSize: '14px', color: 'var(--ink-2)', lineHeight: '1.6' }}>
          Your agent shows you a short key fingerprint. Go to <a href="/dashboard/devices" style={{ color: '#a78bfa', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Dashboard → Devices</a>, find the pending ASC request, and click Approve.
        </p>
      </Step>

      <div style={{ borderRadius: '6px', background: 'var(--bg-raised)', border: '1px solid var(--line)', padding: '14px 16px' }}>
        <p className="micro" style={{ color: 'var(--ink-4)', marginBottom: '8px' }}>Signing — Node.js quick reference</p>
        <pre className="mono" style={{ fontSize: '12px', color: 'var(--ink-3)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{`const ts  = String(Math.floor(Date.now() / 1000));
const msg = Buffer.from(\`\${ts}:\${tokenId}\`);
const sig = crypto.sign(null, msg, privateKey).toString('base64');
// X-Agent-Timestamp: ts
// X-Agent-Signature: sig
// X-Agent-PublicKey: pubKeyB64`}</pre>
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

function CompareMethodsPanel() {
  const rows = [
    ['Pre-existing token needed', '✓ Yes', '✗ No',  '✗ No' ],
    ['Requires browser (once)',   '✗ No',  '✓ Yes', '✗ No' ],
    ['Per-agent token',           '✗ No',  '✓ Yes', '✓ Yes'],
    ['Revoke one agent only',     '✗ No',  '✓ Yes', '✓ Yes'],
    ['Works across IPs',          '— Fingerprint', '✓ Yes', '✓ Yes'],
    ['Cryptographic proof',       '✗ No',  '✗ No',  '✓ Yes'],
    ['Setup complexity',          'None',  'Low',   'Medium'],
  ];
  return (
    <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--line)' }}>
      <table style={{ width: '100%', fontSize: '12px', minWidth: '400px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-raised)' }}>
            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--ink-4)', fontWeight: 500, width: '176px' }}></th>
            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--ink-2)', fontWeight: 600 }}>Master Token</th>
            <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--accent)', fontWeight: 600 }}>OAuth PKCE</th>
            <th style={{ textAlign: 'center', padding: '12px 16px', color: '#a78bfa', fontWeight: 600 }}>ASC Keypair</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, master, oauth, asc], i) => (
            <tr key={label} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
              <td style={{ padding: '10px 16px', color: 'var(--ink-2)' }}>{label}</td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}><CellValue value={master} /></td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}><CellValue value={oauth} /></td>
              <td style={{ padding: '10px 16px', textAlign: 'center' }}><CellValue value={asc} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Agent tabs config ─────────────────────────────────────────────────────────
const AGENT_TABS = [
  { id: 'oauth',   label: 'OAuth PKCE',  sub: 'Recommended · browser flow', activeColor: 'var(--accent)'  },
  { id: 'asc',     label: 'ASC Keypair', sub: 'Advanced · fully headless',  activeColor: '#a78bfa'        },
  { id: 'compare', label: 'Compare',     sub: 'Method comparison',          activeColor: 'var(--ink)'     },
];

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function Connectors() {
  const [agentTab, setAgentTab] = useState('compare');

  return (
    <div className="ui-page">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">GATEWAY</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">Connectors</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Connect AI assistants, install the desktop daemon, and issue tokens to headless agents.</p>
        </div>
      </div>

      {/* ── AI Assistants ─────────────────────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>AI Assistants</h2>
          <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '2px' }}>OAuth connections to external AI tools — authorize once, no tokens to paste.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CONNECTORS.map(c => (
            <article key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              paddingLeft: '20px', paddingRight: '16px', paddingTop: '14px', paddingBottom: '14px',
              borderRadius: '6px', border: '1px solid var(--line)',
              background: 'var(--bg-raised)',
              overflow: 'hidden', transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0,
                background: c.iconBg, border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: c.iconColor,
              }}>
                {c.logo}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{c.provider}</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '2px', lineHeight: '1.4' }}>{c.description}</p>
              </div>
              {c.status === 'available' ? (
                <a href={c.href} target="_blank" rel="noreferrer" className="btn-primary" style={{ flexShrink: 0, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Connect →
                </a>
              ) : (
                <span style={{ flexShrink: 0, fontSize: '11px', color: 'var(--ink-4)', fontWeight: 500, whiteSpace: 'nowrap' }}>Coming soon</span>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="hairline" style={{ borderTopWidth: '1px', borderTopStyle: 'solid' }} />

      {/* ── AFP Daemon ────────────────────────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>AFP — Desktop Daemon</h2>
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '3px', background: 'rgba(210,153,34,0.15)', color: 'var(--amber)', border: '1px solid rgba(210,153,34,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pro</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '2px' }}>Give AI agents sandboxed access to your local files and shell.</p>
        </div>
        <AfpConnectorCard />
      </section>

      <div className="hairline" style={{ borderTopWidth: '1px', borderTopStyle: 'solid' }} />

      {/* ── Agent Connections ─────────────────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Agent Connections</h2>
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '3px', background: 'rgba(210,153,34,0.15)', color: 'var(--amber)', border: '1px solid rgba(210,153,34,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Beta</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '2px' }}>Issue dedicated tokens to agents — no master token sharing, per-agent revocation.</p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px', background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '6px', width: 'fit-content' }}>
          {AGENT_TABS.map(tab => (
            <button key={tab.id} onClick={() => setAgentTab(tab.id)} style={{
              padding: '8px 14px', borderRadius: '4px', textAlign: 'left',
              background: agentTab === tab.id ? 'var(--bg-hover)' : 'transparent',
              border: 'none', cursor: 'pointer',
              transition: 'background 0.15s',
            }}>
              <p style={{
                fontSize: '12px', fontWeight: 600, lineHeight: 1,
                color: agentTab === tab.id ? tab.activeColor : 'var(--ink-3)',
              }}>{tab.label}</p>
              <p style={{ fontSize: '10px', color: 'var(--ink-4)', marginTop: '2px', lineHeight: 1 }}>{tab.sub}</p>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ maxWidth: '672px' }}>
          {agentTab === 'oauth'   && <OAuthInstallerPanel />}
          {agentTab === 'asc'     && <AscKeypairPanel />}
          {agentTab === 'compare' && <CompareMethodsPanel />}
        </div>
      </section>

    </div>
  );
}
