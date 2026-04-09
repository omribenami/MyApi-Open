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
    <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <span className="text-[11px] text-slate-600 font-mono uppercase tracking-wider">{label}</span>
        <button
          onClick={copy}
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded transition-all ${
            isViolet
              ? 'text-violet-400 hover:text-violet-300 hover:bg-violet-500/10'
              : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
          }`}
        >
          {copied ? (
            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Copied</>
          ) : (
            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
          )}
        </button>
      </div>
      <pre className="text-[11px] text-slate-400 px-4 py-3.5 overflow-x-auto leading-relaxed whitespace-pre-wrap break-words font-mono"><code>{text}</code></pre>
    </div>
  );
}

// ─── Data ──────────────────────────────────────────────────────────────────────
const CONNECTORS = [
  {
    id: 'chatgpt', name: 'ChatGPT', provider: 'OpenAI', status: 'available',
    href: 'https://chatgpt.com/g/g-69a90f35a0888191ae6346c9b129b9a8-myapi-assistant',
    description: 'Ask ChatGPT questions about your MyApi data — no setup required.',
    color: 'text-emerald-400', bgColor: 'bg-emerald-400/10', borderColor: 'border-emerald-400/20',
    logo: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387 2.019-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.411-.663zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>,
  },
  {
    id: 'claude', name: 'Claude', provider: 'Anthropic', status: 'coming_soon', href: null,
    description: 'Connect Claude AI agents to your MyApi account.',
    color: 'text-orange-400', bgColor: 'bg-orange-400/10', borderColor: 'border-orange-400/20',
    logo: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M17.304 3.541 12.001 17.51 6.697 3.541H3L9.999 21h4.003L21 3.541h-3.696z"/></svg>,
  },
  {
    id: 'copilot', name: 'GitHub Copilot', provider: 'Microsoft', status: 'coming_soon', href: null,
    description: 'Expose your MyApi data to Copilot extensions.',
    color: 'text-sky-400', bgColor: 'bg-sky-400/10', borderColor: 'border-sky-400/20',
    logo: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>,
  },
];

// ─── OS logos ──────────────────────────────────────────────────────────────────
const LinuxLogo = ({ className }) => (<svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-.703 2.388-.395.431-.658.308-.658.308s-3.027-.547-4.856-.547c-1.713 0-2.637 2.737-2.637 4.508v2.726c0 .593.215 1.181.62 1.629.294.326.648.532 1.026.641l.145.038-.059.194c-.108.36-.162.74-.162 1.123 0 1.893 1.545 3.43 3.443 3.43.924 0 1.758-.358 2.384-.941l.045-.043.149.155c.634.657 1.517 1.065 2.498 1.065h.003c.98 0 1.864-.408 2.498-1.065l.149-.155.045.043c.626.583 1.46.941 2.384.941 1.898 0 3.443-1.537 3.443-3.43 0-.383-.054-.763-.162-1.123l-.059-.194.145-.038c.378-.109.732-.315 1.026-.641.405-.448.62-1.036.62-1.629v-2.726c0-1.771-.924-4.508-2.637-4.508-1.829 0-4.856.547-4.856.547s-.263.123-.658-.308c-.403-.435-.627-1.296-.703-2.388-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021zm.016 1.92c.07 0 .137.003.203.008 2.368.187 2.136 3.089 2.098 4.817-.033 1.486.216 2.766.884 3.49.474.52 1.063.73 1.669.73.605 0 1.195-.21 1.669-.73.668-.724.917-2.004.884-3.49-.038-1.728-.27-4.63 2.098-4.817.066-.005.133-.008.203-.008 1.426 0 1.688 2.527 1.688 3.558v2.726c0 .177-.063.348-.179.478-.116.128-.275.2-.441.2h-.001c-.165 0-.325-.072-.441-.2-.116-.13-.179-.301-.179-.478v-1.5h-.48v1.5c0 .374-.151.729-.419.988-.268.258-.63.402-1.001.402h-2.4c-.371 0-.733-.144-1.001-.402-.268-.259-.419-.614-.419-.988V7.58c0-.25-.101-.49-.282-.665-.18-.177-.424-.275-.678-.275s-.498.098-.678.275c-.181.175-.282.415-.282.665v1.9c0 .374-.151.729-.419.988-.268.258-.63.402-1.001.402H9.6c-.371 0-.733-.144-1.001-.402-.268-.259-.419-.614-.419-.988V7.58c0-.25-.101-.49-.282-.665-.18-.177-.424-.275-.678-.275s-.498.098-.678.275c-.181.175-.282.415-.282.665v1.5H5.78v-1.5c0-.177-.063-.348-.179-.478-.116-.128-.276-.2-.441-.2-.166 0-.325.072-.441.2-.116.13-.179.301-.179.478v2.726c0 .177.063.348.179.478.116.128.275.2.441.2.167 0 .325-.072.441-.2.116-.13.179-.301.179-.478V9.48h.48v1.026c0 .593.215 1.181.62 1.629.405.448.958.694 1.52.694h2.4c.562 0 1.115-.246 1.52-.694.405-.448.62-1.036.62-1.629V7.58c0-.25.101-.49.282-.665.18-.177.424-.275.678-.275s.498.098.678.275c.181.175.282.415.282.665v2.906c0 .593.215 1.181.62 1.629.405.448.958.694 1.52.694h2.4c.562 0 1.115-.246 1.52-.694.405-.448.62-1.036.62-1.629V9.48h.48v1.026c0 .177.063.348.179.478.116.128.275.2.441.2.166 0 .325-.072.441-.2.116-.13.179-.301.179-.478V8.784c0-1.031-.262-3.558 1.688-3.558-.013 0-.013-.884-1.2-.884h-.003z"/></svg>);
const AppleLogo = ({ className }) => (<svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>);
const WindowsLogo = ({ className }) => (<svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>);

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getPlatformMeta(platform) {
  switch (platform) {
    case 'linux':  return { label: 'Linux',   Logo: LinuxLogo,   color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' };
    case 'darwin': return { label: 'macOS',   Logo: AppleLogo,   color: 'text-slate-300',  bg: 'bg-slate-300/10',  border: 'border-slate-300/20'  };
    case 'win32':  return { label: 'Windows', Logo: WindowsLogo, color: 'text-sky-400',    bg: 'bg-sky-400/10',    border: 'border-sky-400/20'    };
    default:       return { label: platform || 'Unknown', Logo: null, color: 'text-slate-400', bg: 'bg-slate-700/40', border: 'border-slate-600/40' };
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

// ─── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ num, title, description, badge }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <span className="mt-0.5 flex-none w-7 h-7 rounded-full bg-slate-800 border border-slate-700/80 text-slate-500 text-[10px] font-mono font-bold flex items-center justify-center select-none">
        {num}
      </span>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h2>
          {badge && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wide uppercase">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ─── DeviceRow ─────────────────────────────────────────────────────────────────
function DeviceRow({ device, onRevoke }) {
  const [confirming, setConfirming] = useState(false);
  const pm = getPlatformMeta(device.platform);
  const isOnline = device.status === 'online';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
      isOnline ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-slate-900/60 border-slate-800'
    }`}>
      <div className={`w-8 h-8 rounded-lg ${pm.bg} border ${pm.border} flex items-center justify-center flex-none`}>
        {pm.Logo ? <pm.Logo className={`w-4 h-4 ${pm.color}`} /> : <span className="text-xs text-slate-500">{(device.platform || '?')[0].toUpperCase()}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-200 truncate">{device.name}</span>
          <span className="text-xs text-slate-600">{device.hostname}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
            device.privileges === 'full'
              ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {device.privileges === 'full' ? 'Full access' : `Restricted: ${device.afpRoot}`}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11px] text-slate-500">{pm.label} · {device.arch}</span>
          <span className="text-[11px] text-slate-600">Last seen {fmtRelTime(device.lastSeenAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-none">
        <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium ${
          isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          {device.status}
        </span>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button onClick={() => { onRevoke(device.id); setConfirming(false); }} className="text-[11px] px-2.5 py-1 rounded-md bg-red-600 text-white hover:bg-red-500 font-medium transition-colors">Confirm</button>
            <button onClick={() => setConfirming(false)} className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="w-7 h-7 rounded flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── OS platform configs ───────────────────────────────────────────────────────
const OS_PLATFORMS = [
  { platform: 'linux',   label: 'Linux',   sublabel: 'x86-64',       Logo: LinuxLogo,   iconColor: 'text-yellow-400', iconBg: 'bg-yellow-400/10', iconBorder: 'border-yellow-400/20' },
  { platform: 'mac',     label: 'macOS',   sublabel: 'Intel',         Logo: AppleLogo,   iconColor: 'text-slate-300',  iconBg: 'bg-slate-300/10',  iconBorder: 'border-slate-300/20'  },
  { platform: 'mac-arm', label: 'macOS',   sublabel: 'Apple Silicon', Logo: AppleLogo,   iconColor: 'text-slate-300',  iconBg: 'bg-slate-300/10',  iconBorder: 'border-slate-300/20'  },
  { platform: 'win',     label: 'Windows', sublabel: 'x86-64',        Logo: WindowsLogo, iconColor: 'text-sky-400',    iconBg: 'bg-sky-400/10',    iconBorder: 'border-sky-400/20'    },
];

// ─── Desktop App platform configs (Electron — GitHub Releases) ────────────────
const GH_RELEASES_BASE = 'https://github.com/omribenami/MyApi/releases/latest/download';
const DESKTOP_PLATFORMS = [
  {
    platform: 'mac-arm', label: 'macOS', sublabel: 'Apple Silicon',
    Logo: AppleLogo, iconColor: 'text-slate-300', iconBg: 'bg-slate-300/10', iconBorder: 'border-slate-300/20',
    href: `${GH_RELEASES_BASE}/MyApi-AFP-mac-arm64.dmg`, filename: 'MyApi-AFP-mac-arm64.dmg',
  },
  {
    platform: 'mac',     label: 'macOS', sublabel: 'Intel',
    Logo: AppleLogo, iconColor: 'text-slate-300', iconBg: 'bg-slate-300/10', iconBorder: 'border-slate-300/20',
    href: `${GH_RELEASES_BASE}/MyApi-AFP-mac-x64.dmg`, filename: 'MyApi-AFP-mac-x64.dmg',
  },
  {
    platform: 'win',     label: 'Windows', sublabel: 'x86-64',
    Logo: WindowsLogo, iconColor: 'text-sky-400', iconBg: 'bg-sky-400/10', iconBorder: 'border-sky-400/20',
    href: `${GH_RELEASES_BASE}/MyApi-AFP-win-x64.exe`, filename: 'MyApi-AFP-win-x64.exe',
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
      { title: 'Download', body: 'Pick your OS and save the file. No dependencies.' },
      { title: 'Run it', body: 'Double-click (Windows) or run from terminal (Mac/Linux). Your browser opens automatically.' },
      { title: 'Sign in', body: 'Log in and click Authorize. The daemon connects and stays running in the background.' },
      { title: 'Done', body: 'Your PC appears in Connected Devices below. Agents can now access it.' },
    ],
    daemon: [
      { title: 'Download', body: 'Pick your OS and save the file.' },
      { title: 'Run it', body: 'Double-click (Windows) or run from terminal. A wizard asks for your server URL and API token.' },
      { title: 'Auto-start', body: 'The wizard can install it as a background service.' },
      { title: 'Done', body: 'Your PC appears in Connected Devices below.' },
    ],
    desktop: [
      { title: 'Download', body: 'Pick your platform. macOS: open the DMG and drag to Applications. Windows: run the installer.' },
      { title: 'First launch', body: 'The app icon appears in your menu bar (Mac) or system tray (Windows) and your browser opens automatically to sign in.' },
      { title: 'Authorize', body: 'Log in and click Authorize. The app connects and shows a green dot when ready.' },
      { title: 'Done', body: 'Your device appears in Connected Devices below. Use the tray icon to disconnect, re-authenticate, or toggle Start on Login.' },
    ],
  };

  if (!isAfpEnabled) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-6 py-8 text-center">
        <p className="text-xs font-semibold text-amber-400 mb-2">Pro &amp; Enterprise only</p>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">AFP connectors let AI agents access your files and shell. Upgrade to unlock.</p>
        <a href="/dashboard/settings?section=billing" className="inline-block mt-4 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">Upgrade Plan</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Edition toggle */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit flex-wrap">
        {[
          { id: 'desktop', label: 'Desktop App',    badge: 'New',         badgeStyle: 'bg-emerald-500/15 text-emerald-400' },
          { id: 'oauth',   label: 'CLI Sign-in',    badge: 'Recommended', badgeStyle: 'bg-violet-500/15 text-violet-400'   },
          { id: 'daemon',  label: 'CLI Token',      badge: 'Self-hosted', badgeStyle: 'bg-slate-700/60 text-slate-500'     },
        ].map(e => (
          <button key={e.id} onClick={() => setEdition(e.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              edition === e.id ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {e.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${e.badgeStyle}`}>{e.badge}</span>
          </button>
        ))}
      </div>

      {/* Download grid */}
      {edition === 'desktop' ? (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            {DESKTOP_PLATFORMS.map(os => (
              <a key={os.platform} href={os.href} download={os.filename}
                className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all no-underline">
                <div className={`w-10 h-10 rounded-xl ${os.iconBg} border ${os.iconBorder} flex items-center justify-center transition-transform group-hover:scale-105`}>
                  <os.Logo className={`w-5 h-5 ${os.iconColor}`} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-200">{os.label}</p>
                  <p className="text-[11px] text-slate-500">{os.sublabel}</p>
                </div>
                <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </a>
            ))}
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <svg className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            <p className="text-[11px] text-amber-300 leading-relaxed">
              Unsigned build — macOS: right-click → Open to bypass Gatekeeper.
              Windows: click "More info" → "Run anyway" in SmartScreen.
              Code signing coming soon.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {OS_PLATFORMS.map(os => {
            const info = edition === 'oauth' ? downloadOAuthInfo : downloadInfo;
            const size = getSize(info, os.platform);
            const key  = `${edition}-${os.platform}`;
            const isLoading = downloading === key;
            return (
              <button key={os.platform} onClick={() => handleDownload(edition, os.platform)} disabled={!!downloading}
                className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all disabled:opacity-50 disabled:cursor-wait">
                <div className={`w-10 h-10 rounded-xl ${os.iconBg} border ${os.iconBorder} flex items-center justify-center transition-transform group-hover:scale-105`}>
                  {isLoading
                    ? <svg className="w-4 h-4 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    : <os.Logo className={`w-5 h-5 ${os.iconColor}`} />
                  }
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-200">{os.label}</p>
                  <p className="text-[11px] text-slate-500">{os.sublabel}</p>
                  {size && <p className="text-[11px] text-slate-600 mt-0.5">{size}</p>}
                </div>
                {!isLoading && <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
              </button>
            );
          })}
        </div>
      )}

      {/* How to install */}
      <div className="border border-slate-800 rounded-xl overflow-hidden">
        <button onClick={() => setInstallOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/30 transition-colors">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">How to install</span>
          <svg className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${installOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {installOpen && (
          <div className="px-4 pb-5 pt-3 border-t border-slate-800 space-y-4">
            {installSteps[edition].map((s, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-bold flex items-center justify-center flex-none mt-0.5">{i + 1}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-300">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linux service management */}
      {edition !== 'desktop' && (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <button onClick={() => setLinuxOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-2">
              <LinuxLogo className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Linux — Service Management</span>
            </div>
            <svg className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${linuxOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {linuxOpen && (
            <div className="px-4 pb-5 pt-3 border-t border-slate-800 space-y-5">

              {/* Install as service */}
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">Install as a systemd service</p>
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
                <p className="text-[11px] text-slate-500 mt-2">The service starts immediately and will auto-start on every boot.</p>
              </div>

              {/* Enable / Disable */}
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">Enable / Disable auto-start</p>
                <div className="space-y-2">
                  <CopyBlock accent="blue" label="enable" text="sudo systemctl enable myapi-afp && sudo systemctl start myapi-afp" />
                  <CopyBlock accent="blue" label="disable" text="sudo systemctl disable myapi-afp && sudo systemctl stop myapi-afp" />
                </div>
              </div>

              {/* Uninstall */}
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">Uninstall</p>
                <CopyBlock accent="blue" label="bash" text={`sudo systemctl stop myapi-afp
sudo systemctl disable myapi-afp
sudo rm /etc/systemd/system/myapi-afp.service
sudo rm /usr/local/bin/myapi-afp
sudo systemctl daemon-reload`} />
                <p className="text-[11px] text-slate-500 mt-2">This removes the binary and service file. Your credentials at <span className="font-mono text-slate-400">~/.myapi/</span> are not deleted — remove that folder manually if desired.</p>
              </div>

            </div>
          )}
        </div>
      )}

      {/* Connected devices */}
      {!loading && totalCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Connected Devices</p>
            {onlineCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{onlineCount} online
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {devices.map(device => (
              <DeviceRow key={device.id} device={device}
                onRevoke={id => apiClient.delete(`/afp/devices/${id}`).then(() => setDevices(ds => ds.filter(d => d.id !== id))).catch(() => alert('Failed to revoke'))} />
            ))}
          </div>
        </div>
      )}
      {!loading && totalCount === 0 && (
        <p className="text-xs text-slate-600 text-center py-3">No devices connected. Download and run the app above to get started.</p>
      )}
    </div>
  );
}

// ─── Step ──────────────────────────────────────────────────────────────────────
function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold flex items-center justify-center flex-none">{n}</span>
        <div className="w-px flex-1 bg-slate-800 min-h-[20px] mt-1" />
      </div>
      <div className="pb-5 flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-200 mb-2.5">{title}</p>
        {children}
      </div>
    </div>
  );
}

// ─── OAuthInstallerPanel ───────────────────────────────────────────────────────
function OAuthInstallerPanel() {
  return (
    <div>
      <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 mb-6">
        <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-xs text-blue-300 leading-relaxed">
          <strong className="font-semibold">You run this — not the agent.</strong> The installer needs your browser and a local port. Agents in sandboxes or cloud environments can't receive localhost callbacks.
        </p>
      </div>

      <Step n="1" title="Run on your machine">
        <CopyBlock label="terminal" accent="blue" text="curl -sL https://www.myapiai.com/api/v1/agent-auth/install.js | node" />
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">Your browser opens. Once you authorize, the terminal prints a token starting with <span className="font-mono text-slate-300">myapi_</span></p>
      </Step>

      <Step n="2" title="Give the token to your agent">
        <CopyBlock label="agent prompt" accent="blue" text={`I ran the MyApi agent auth installer on my machine and got this access token:

myapi_PASTE_TOKEN_HERE

Please save this as your MyApi Bearer token and use it for all API requests:
  Authorization: Bearer myapi_PASTE_TOKEN_HERE
  Base URL: https://www.myapiai.com/api/v1/

Do not ask me to run the installer — I already ran it. Just use this token.`} />
      </Step>

      <div className="rounded-lg bg-slate-900 border border-slate-800 px-4 py-3.5">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Optional flags</p>
        <div className="space-y-1 font-mono text-xs text-slate-500">
          <p><span className="text-slate-300">--save</span>  → saves token to <span className="text-slate-400">~/.myapi/agent-token.json</span></p>
          <p><span className="text-slate-300">--json</span>  → outputs <span className="text-slate-400">{'{"token":"myapi_..."}'}</span> for scripting</p>
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
        <p className="text-sm text-slate-400 leading-relaxed">
          Your agent shows you a short key fingerprint. Go to <a href="/dashboard/devices" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">Dashboard → Devices</a>, find the pending ASC request, and click Approve.
        </p>
      </Step>

      <div className="rounded-lg bg-slate-900 border border-slate-800 px-4 py-3.5">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Signing — Node.js quick reference</p>
        <pre className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap font-mono">{`const ts  = String(Math.floor(Date.now() / 1000));
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
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-xs min-w-[400px]">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/60">
            <th className="text-left px-4 py-3 text-slate-600 font-medium w-44"></th>
            <th className="text-center px-4 py-3 text-slate-400 font-semibold">Master Token</th>
            <th className="text-center px-4 py-3 text-blue-400 font-semibold">OAuth PKCE</th>
            <th className="text-center px-4 py-3 text-violet-400 font-semibold">ASC Keypair</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, master, oauth, asc]) => (
            <tr key={label} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors last:border-0">
              <td className="px-4 py-3 text-slate-400">{label}</td>
              <td className="px-4 py-3 text-center text-slate-500">{master}</td>
              <td className="px-4 py-3 text-center text-slate-300">{oauth}</td>
              <td className="px-4 py-3 text-center text-slate-300">{asc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function Connectors() {
  const [agentTab, setAgentTab] = useState('compare');
  const [howOpen, setHowOpen]   = useState(false);

  const AGENT_TABS = [
    { id: 'oauth',   label: 'OAuth Installer', sub: 'Recommended · browser flow', accent: 'blue'   },
    { id: 'asc',     label: 'ASC Keypair',     sub: 'Advanced · fully headless',  accent: 'violet' },
    { id: 'compare', label: 'Compare',         sub: 'Method comparison',          accent: 'slate'  },
  ];

  return (
    <div className="max-w-3xl">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-lg font-semibold text-white tracking-tight">Connectors</h1>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed max-w-lg">
          Connect AI assistants, install desktop daemons, and issue tokens to headless agents.
        </p>
      </div>

      <div className="space-y-10">

        {/* ── 01 · AI Assistants ─────────────────────────────────────────── */}
        <section>
          <SectionHeader
            num="01"
            title="AI Assistants"
            description="OAuth connections to external AI tools — authorize once, no tokens to paste"
          />
          <div className="pl-11 space-y-3">
            {/* Connector list */}
            <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
              {CONNECTORS.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 bg-slate-900 hover:bg-slate-800/40 transition-colors">
                  <div className={`w-10 h-10 rounded-xl ${c.bgColor} border ${c.borderColor} flex items-center justify-center flex-none`}>
                    <div className={c.color}>{c.logo}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-200">{c.name}</p>
                      <span className="text-xs text-slate-600">{c.provider}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{c.description}</p>
                  </div>
                  {c.status === 'available' ? (
                    <a href={c.href} target="_blank" rel="noreferrer"
                      className="flex-none px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap">
                      Connect →
                    </a>
                  ) : (
                    <span className="flex-none text-xs text-slate-600 font-medium">Coming soon</span>
                  )}
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <button onClick={() => setHowOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/30 transition-colors">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">How it works</span>
                <svg className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${howOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {howOpen && (
                <div className="border-t border-slate-800 px-5 py-5 space-y-5">
                  <div className="grid sm:grid-cols-3 gap-5">
                    {[
                      { n: '1', title: 'Click Connect', body: "You're taken to the AI service." },
                      { n: '2', title: 'Authorize', body: 'MyApi data is shared securely via OAuth. No tokens to copy or paste.' },
                      { n: '3', title: 'Start asking', body: 'The assistant can read your MyApi data and answer in plain language.' },
                    ].map(s => (
                      <div key={s.n} className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center flex-none mt-0.5">{s.n}</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-300">{s.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-2.5">Example questions</p>
                    <div className="flex flex-wrap gap-2">
                      {["What's my current persona?", 'Show me my knowledge base', 'Which services am I connected to?', 'What access tokens do I have?', 'Summarize my recent activity'].map(q => (
                        <span key={q} className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700/60 text-slate-400">"{q}"</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="border-t border-slate-800/60" />

        {/* ── 02 · AFP Daemon ────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            num="02"
            title="AFP — Desktop Daemon"
            description="Give AI agents sandboxed access to your local files and shell"
          />
          <div className="pl-11">
            <AfpConnectorCard />
          </div>
        </section>

        <div className="border-t border-slate-800/60" />

        {/* ── 03 · Agent Connections ─────────────────────────────────────── */}
        <section>
          <SectionHeader
            num="03"
            title="Agent Connections"
            description="Issue dedicated tokens to agents — no master token sharing, per-agent revocation"
            badge="Beta"
          />

          <div className="pl-11 space-y-4">
            {/* Beta notice */}
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <p className="text-xs text-amber-300 leading-relaxed">Flows are functional but may change before general availability.</p>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit">
              {AGENT_TABS.map(tab => (
                <button key={tab.id} onClick={() => setAgentTab(tab.id)}
                  className={`px-3.5 py-2 rounded-md text-left transition-all ${
                    agentTab === tab.id ? 'bg-slate-700 shadow-sm' : 'hover:bg-slate-800/60'
                  }`}>
                  <p className={`text-xs font-semibold leading-none ${
                    agentTab === tab.id
                      ? tab.accent === 'violet' ? 'text-violet-300'
                      : tab.accent === 'blue'   ? 'text-blue-300'
                      :                           'text-slate-200'
                      : 'text-slate-500'
                  }`}>{tab.label}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5 leading-none">{tab.sub}</p>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="pt-1">
              {agentTab === 'oauth'   && <OAuthInstallerPanel />}
              {agentTab === 'asc'     && <AscKeypairPanel />}
              {agentTab === 'compare' && <CompareMethodsPanel />}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
