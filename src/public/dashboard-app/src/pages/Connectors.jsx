import { useEffect, useState } from 'react';
import apiClient from '../utils/apiClient';

const CONNECTORS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    description: 'Ask ChatGPT questions about your MyApi data. Click Connect, sign in, and start chatting — no setup required.',
    href: 'https://chatgpt.com/g/g-69a90f35a0888191ae6346c9b129b9a8-myapi-assistant',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387 2.019-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.411-.663zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
    ),
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/20',
    status: 'available',
  },
  {
    id: 'claude',
    href: null,
    name: 'Claude',
    provider: 'Anthropic',
    description: 'Connect Claude AI agents to your MyApi account. Coming soon.',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M17.304 3.541 12.001 17.51 6.697 3.541H3L9.999 21h4.003L21 3.541h-3.696z"/>
      </svg>
    ),
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/20',
    status: 'coming_soon',
  },
  {
    id: 'copilot',
    href: null,
    name: 'GitHub Copilot',
    provider: 'Microsoft',
    description: 'Expose your MyApi data to Copilot extensions. Coming soon.',
    logo: (
      <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/20',
    status: 'coming_soon',
  },
];

// OS logo SVGs
const LinuxLogo = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-.703 2.388-.395.431-.658.308-.658.308s-3.027-.547-4.856-.547c-1.713 0-2.637 2.737-2.637 4.508v2.726c0 .593.215 1.181.62 1.629.294.326.648.532 1.026.641l.145.038-.059.194c-.108.36-.162.74-.162 1.123 0 1.893 1.545 3.43 3.443 3.43.924 0 1.758-.358 2.384-.941l.045-.043.149.155c.634.657 1.517 1.065 2.498 1.065h.003c.98 0 1.864-.408 2.498-1.065l.149-.155.045.043c.626.583 1.46.941 2.384.941 1.898 0 3.443-1.537 3.443-3.43 0-.383-.054-.763-.162-1.123l-.059-.194.145-.038c.378-.109.732-.315 1.026-.641.405-.448.62-1.036.62-1.629v-2.726c0-1.771-.924-4.508-2.637-4.508-1.829 0-4.856.547-4.856.547s-.263.123-.658-.308c-.403-.435-.627-1.296-.703-2.388-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021zm.016 1.92c.07 0 .137.003.203.008 2.368.187 2.136 3.089 2.098 4.817-.033 1.486.216 2.766.884 3.49.474.52 1.063.73 1.669.73.605 0 1.195-.21 1.669-.73.668-.724.917-2.004.884-3.49-.038-1.728-.27-4.63 2.098-4.817.066-.005.133-.008.203-.008 1.426 0 1.688 2.527 1.688 3.558v2.726c0 .177-.063.348-.179.478-.116.128-.275.2-.441.2h-.001c-.165 0-.325-.072-.441-.2-.116-.13-.179-.301-.179-.478v-1.5h-.48v1.5c0 .374-.151.729-.419.988-.268.258-.63.402-1.001.402h-2.4c-.371 0-.733-.144-1.001-.402-.268-.259-.419-.614-.419-.988V7.58c0-.25-.101-.49-.282-.665-.18-.177-.424-.275-.678-.275s-.498.098-.678.275c-.181.175-.282.415-.282.665v1.9c0 .374-.151.729-.419.988-.268.258-.63.402-1.001.402H9.6c-.371 0-.733-.144-1.001-.402-.268-.259-.419-.614-.419-.988V7.58c0-.25-.101-.49-.282-.665-.18-.177-.424-.275-.678-.275s-.498.098-.678.275c-.181.175-.282.415-.282.665v1.5H5.78v-1.5c0-.177-.063-.348-.179-.478-.116-.128-.276-.2-.441-.2-.166 0-.325.072-.441.2-.116.13-.179.301-.179.478v2.726c0 .177.063.348.179.478.116.128.275.2.441.2.167 0 .325-.072.441-.2.116-.13.179-.301.179-.478V9.48h.48v1.026c0 .593.215 1.181.62 1.629.405.448.958.694 1.52.694h2.4c.562 0 1.115-.246 1.52-.694.405-.448.62-1.036.62-1.629V7.58c0-.25.101-.49.282-.665.18-.177.424-.275.678-.275s.498.098.678.275c.181.175.282.415.282.665v2.906c0 .593.215 1.181.62 1.629.405.448.958.694 1.52.694h2.4c.562 0 1.115-.246 1.52-.694.405-.448.62-1.036.62-1.629V9.48h.48v1.026c0 .177.063.348.179.478.116.128.275.2.441.2.166 0 .325-.072.441-.2.116-.13.179-.301.179-.478V8.784c0-1.031-.262-3.558 1.688-3.558-.013 0-.013-.884-1.2-.884h-.003z"/>
  </svg>
);

const AppleLogo = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
  </svg>
);

const WindowsLogo = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
  </svg>
);

// ── OS helpers ────────────────────────────────────────────────────────────────

function getPlatformMeta(platform) {
  switch (platform) {
    case 'linux':
      return { label: 'Linux', Logo: LinuxLogo, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' };
    case 'darwin':
      return { label: 'macOS', Logo: AppleLogo, color: 'text-slate-300', bg: 'bg-slate-300/10', border: 'border-slate-300/20' };
    case 'win32':
      return { label: 'Windows', Logo: WindowsLogo, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' };
    default:
      return { label: platform || 'Unknown', Logo: null, color: 'text-slate-400', bg: 'bg-slate-700/40', border: 'border-slate-600/40' };
  }
}

function fmtRelTime(isoStr) {
  if (!isoStr) return 'never';
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function DeviceRow({ device, onRevoke }) {
  const [confirming, setConfirming] = useState(false);
  const pm = getPlatformMeta(device.platform);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
      device.status === 'online'
        ? 'bg-emerald-950/20 border-emerald-800/30'
        : 'bg-slate-800/40 border-slate-700/40'
    }`}>
      {/* OS icon */}
      <div className={`w-8 h-8 rounded-lg ${pm.bg} border ${pm.border} flex items-center justify-center shrink-0`}>
        {pm.Logo
          ? <pm.Logo className={`w-4 h-4 ${pm.color}`} />
          : <span className="text-xs text-slate-500">{(device.platform || '?')[0].toUpperCase()}</span>
        }
      </div>

      {/* Device info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-200 truncate">{device.name}</span>
          <span className="text-xs text-slate-500">{device.hostname}</span>
          {/* Privileges badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            device.privileges === 'full'
              ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {device.privileges === 'full' ? 'Full access' : `Restricted: ${device.afpRoot}`}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-500">{pm.label} · {device.arch}</span>
          <span className="text-xs text-slate-600">
            Last seen: {fmtRelTime(device.lastSeenAt)}
          </span>
        </div>
      </div>

      {/* Status + revoke */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
          device.status === 'online'
            ? 'bg-emerald-400/10 text-emerald-400'
            : 'bg-slate-700/50 text-slate-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            device.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
          }`} />
          {device.status}
        </span>

        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onRevoke(device.id); setConfirming(false); }}
              className="text-xs px-2 py-1 rounded bg-red-600/80 text-white hover:bg-red-500 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            title="Revoke this device"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Format bytes for display
function fmtBytes(bytes) {
  if (!bytes) return '';
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

const OS_PLATFORMS = [
  {
    platform: 'linux',
    label: 'Linux',
    sublabel: 'x86-64',
    Logo: LinuxLogo,
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-400/10',
    iconBorder: 'border-yellow-400/20',
    hoverBorder: 'hover:border-yellow-500/40',
    hoverBg: 'hover:bg-yellow-400/5',
  },
  {
    platform: 'mac',
    label: 'macOS',
    sublabel: 'Intel',
    Logo: AppleLogo,
    iconColor: 'text-slate-300',
    iconBg: 'bg-slate-300/10',
    iconBorder: 'border-slate-300/20',
    hoverBorder: 'hover:border-slate-400/40',
    hoverBg: 'hover:bg-slate-300/5',
  },
  {
    platform: 'mac-arm',
    label: 'macOS',
    sublabel: 'Apple Silicon',
    Logo: AppleLogo,
    iconColor: 'text-slate-300',
    iconBg: 'bg-slate-300/10',
    iconBorder: 'border-slate-300/20',
    hoverBorder: 'hover:border-slate-400/40',
    hoverBg: 'hover:bg-slate-300/5',
  },
  {
    platform: 'win',
    label: 'Windows',
    sublabel: 'x86-64',
    Logo: WindowsLogo,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-400/10',
    iconBorder: 'border-blue-400/20',
    hoverBorder: 'hover:border-blue-500/40',
    hoverBg: 'hover:bg-blue-400/5',
  },
];

function AfpConnectorCard() {
  const [devices, setDevices] = useState([]);
  const [downloadInfo, setDownloadInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    Promise.all([
      apiClient.get('/afp/devices').catch(() => ({ data: { devices: [] } })),
      apiClient.get('/afp/download-info').catch(() => ({ data: { platforms: [] } })),
    ]).then(([devRes, dlRes]) => {
      setDevices(devRes.data?.devices || []);
      setDownloadInfo(dlRes.data?.platforms || []);
    }).finally(() => setLoading(false));
  }, []);

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const totalCount  = devices.length;

  function getSizeForPlatform(platform) {
    const info = downloadInfo.find(p => p.platform === platform);
    return info?.available ? fmtBytes(info.size) : null;
  }

  async function handleDownload(platform) {
    setDownloading(platform);
    try {
      const response = await fetch(`/api/v1/afp/download/${platform}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'Download failed. The binary may not be built yet.');
        return;
      }
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const cd   = response.headers.get('Content-Disposition') || '';
      const nameMatch = cd.match(/filename="?([^"]+)"?/);
      a.href     = url;
      a.download = nameMatch ? nameMatch[1] : `afp-daemon-${platform}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-700/60 rounded-2xl overflow-hidden">

      {/* Card header */}
      <div className="p-6 border-b border-slate-800/60">
        <div className="flex items-start gap-4">
          {/* AFP icon */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" />
              </svg>
            </div>
            {/* Pulse if any device online */}
            {onlineCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 relative" />
              </span>
            )}
          </div>

          {/* Title + description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-semibold text-white">AFP Daemon</h3>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                PC Connector
              </span>
              {!loading && totalCount > 0 && (
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  onlineCount > 0
                    ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${onlineCount > 0 ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  {onlineCount > 0 ? `${onlineCount} of ${totalCount} online` : `${totalCount} registered`}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
              Install the AFP Daemon on any PC to give AI agents secure read, write, and execute access to its file system.
              Works over WebSocket — no port forwarding needed.
            </p>
          </div>
        </div>
      </div>

      {/* Download section */}
      <div className="p-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
          Download for your platform
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {OS_PLATFORMS.map(os => {
            const size = getSizeForPlatform(os.platform);
            const isDownloading = downloading === os.platform;
            return (
              <button
                key={os.platform}
                onClick={() => handleDownload(os.platform)}
                disabled={isDownloading}
                className={`
                  group relative flex flex-col items-center gap-3 p-4 rounded-xl
                  bg-slate-800/50 border border-slate-700/60
                  ${os.hoverBorder} ${os.hoverBg}
                  transition-all duration-200
                  disabled:opacity-60 disabled:cursor-wait
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/40
                `}
              >
                {/* OS icon */}
                <div className={`w-11 h-11 rounded-xl ${os.iconBg} border ${os.iconBorder} flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}>
                  {isDownloading
                    ? <svg className="w-5 h-5 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    : <os.Logo className={`w-5 h-5 ${os.iconColor}`} />
                  }
                </div>

                {/* Labels */}
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-200 leading-tight">{os.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{os.sublabel}</p>
                  {size && <p className="text-xs text-slate-600 mt-1">{size}</p>}
                </div>

                {/* Download arrow */}
                {!isDownloading && (
                  <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Install instructions */}
        <div className="mt-6 rounded-xl bg-slate-800/40 border border-slate-700/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/40">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Quick start</p>
          </div>
          <div className="p-5 space-y-4">
            {[
              {
                n: '1',
                title: 'Download the daemon',
                body: 'Pick your platform above and download the installer. No Node.js or runtime required — it\'s a single self-contained executable.',
              },
              {
                n: '2',
                title: 'Run it once',
                body: 'Double-click (Windows) or run from terminal. A setup wizard will ask for your MyApi URL and master token — it registers itself automatically.',
                code: {
                  linux: 'chmod +x afp-daemon-linux && ./afp-daemon-linux',
                  mac: 'chmod +x afp-daemon-macos-x64 && ./afp-daemon-macos-x64',
                  win: 'afp-daemon-win-x64.exe',
                },
              },
              {
                n: '3',
                title: 'It installs itself as a background service',
                body: 'The wizard offers to install as a system service (launchd / systemd / Task Scheduler) so it starts automatically at login.',
              },
              {
                n: '4',
                title: 'AI agents can now access this PC',
                body: 'Any agent with your master token can list, read, write, and execute commands on this machine via /api/v1/afp/{deviceId}/*.',
              },
            ].map(step => (
              <div key={step.n} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step.n}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-300 text-sm">{step.title}</p>
                  <p className="text-slate-500 mt-0.5 text-sm leading-relaxed">{step.body}</p>
                  {step.code && (
                    <div className="mt-2 rounded-lg bg-slate-900/80 border border-slate-700/50 px-3 py-2">
                      <code className="text-xs text-cyan-300 font-mono">{step.code.linux}</code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connected devices list */}
        {!loading && totalCount > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Registered Devices
            </p>
            <div className="space-y-2">
              {devices.map(device => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  onRevoke={id => {
                    apiClient.delete(`/afp/devices/${id}`)
                      .then(() => setDevices(ds => ds.filter(d => d.id !== id)))
                      .catch(() => alert('Failed to revoke device'));
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {!loading && totalCount === 0 && (
          <div className="mt-4 rounded-xl bg-slate-800/30 border border-slate-700/40 px-5 py-4 flex gap-3">
            <svg className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <div>
              <p className="text-sm text-slate-400 font-medium">No devices registered yet</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Download the daemon above and run it — the setup wizard registers this PC automatically.
                If you already ran setup on an older version, run it again with{' '}
                <code className="text-cyan-400 bg-slate-900/60 px-1 rounded">.\afp-daemon-win-x64.exe --reset</code>{' '}
                (Windows) or{' '}
                <code className="text-cyan-400 bg-slate-900/60 px-1 rounded">./afp-daemon-linux --reset</code>{' '}
                (Linux/Mac) to re-register.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Connectors() {
  return (
    <div className="space-y-10">

      {/* ── AI Connectors ───────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">AI Connectors</h1>
          <p className="mt-1 text-slate-400 text-sm max-w-2xl">
            Connect external AI assistants to your MyApi account using OAuth. Users authorize once — no tokens to paste, no manual setup.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECTORS.map(c => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${c.bgColor} border ${c.borderColor}`}>
                  <div className={c.color}>{c.logo}</div>
                </div>
                {c.status === 'available' ? (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">Available</span>
                ) : (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-700/50 text-slate-500 border border-slate-700">Coming soon</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-100">{c.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{c.provider}</p>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{c.description}</p>
              </div>
              {c.status === 'available' ? (
                <a href={c.href} target="_blank" rel="noreferrer"
                  className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors text-center block">
                  Connect →
                </a>
              ) : (
                <div className="w-full py-2 px-4 rounded-lg bg-slate-800 text-slate-600 text-sm font-medium text-center border border-slate-700 cursor-default">
                  Notify me when ready
                </div>
              )}
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h2 className="font-semibold text-slate-200 mb-5">How connectors work</h2>
          <div className="grid gap-6 sm:grid-cols-3 mb-6">
            {[
              { n: '1', title: 'Click Connect', body: "Hit the Connect button on any available AI connector. You'll be taken directly to the AI service." },
              { n: '2', title: 'Sign in to the AI service', body: 'Authorize the connection when prompted. Your MyApi data is shared securely via OAuth — no tokens to copy or paste.' },
              { n: '3', title: 'Start asking questions', body: "You're ready to go. The AI assistant can now read your MyApi data and answer questions in plain language." },
            ].map(item => (
              <div key={item.n} className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{item.n}</span>
                <div>
                  <p className="font-medium text-slate-300 text-sm">{item.title}</p>
                  <p className="text-slate-500 mt-1 text-sm leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 pt-5">
            <p className="text-xs font-medium text-slate-400 mb-3">Example questions to ask</p>
            <div className="flex flex-wrap gap-2">
              {[
                "What's my current persona?",
                'Show me my knowledge base',
                'Which services am I connected to?',
                'What access tokens do I have?',
                'Summarize my recent activity',
                'What workspaces am I part of?',
              ].map(q => (
                <span key={q} className="text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">"{q}"</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PC & Device Connectors ───────────────────────────────────────── */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100">PC &amp; Device Connectors</h2>
          <p className="mt-1 text-slate-400 text-sm max-w-2xl">
            Install lightweight daemons on your machines to give AI agents direct access to local resources — files, folders, and shell execution.
          </p>
        </div>

        <AfpConnectorCard />
      </section>

    </div>
  );
}
