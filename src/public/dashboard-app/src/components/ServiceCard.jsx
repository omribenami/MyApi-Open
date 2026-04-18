import { useEffect, useMemo, useState } from 'react';
import { formatAuthTypeLabel } from '../utils/serviceCatalog';

function ServiceCard({ service, onConnect, onRevoke, onConfigure }) {
  const isConnected = service.status === 'connected';
  const isNotConfigured = service.notConfigured;

  const logoFallback = (service.label || service.name || '?').slice(0, 1).toUpperCase();
  const logoCandidates = useMemo(() => {
    const candidates = [service.icon, ...(service.logoFallbacks || [])].filter(Boolean);
    return Array.from(new Set(candidates));
  }, [service.icon, service.logoFallbacks]);

  const [logoIndex, setLogoIndex] = useState(0);
  useEffect(() => { setLogoIndex(0); }, [service.name, service.icon, service.logoFallbacks]);
  const activeLogo = logoCandidates[logoIndex] || null;

  return (
    <article className={`relative flex items-center gap-3.5 pl-5 pr-4 py-3.5 rounded-xl border transition-all duration-200 group overflow-hidden ${
      isConnected
        ? 'bg-emerald-950/25 border-emerald-800/40 hover:border-emerald-700/60 hover:bg-emerald-950/35'
        : isNotConfigured
          ? 'bg-slate-900/60 border-slate-800 hover:border-amber-700/30'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
    }`}>

      {/* Left accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-opacity ${
        isConnected ? 'bg-emerald-500/70' : isNotConfigured ? 'bg-amber-500/40' : 'bg-transparent'
      }`} />

      {/* Logo */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        isConnected
          ? 'bg-emerald-900/40 border border-emerald-700/30'
          : 'bg-slate-800/80 border border-slate-700/50'
      }`} aria-hidden="true">
        {activeLogo ? (
          <img
            src={activeLogo}
            alt=""
            className="w-4.5 h-4.5 object-contain"
            style={{ width: '18px', height: '18px' }}
            loading="lazy"
            onError={() => {
              if (logoIndex < logoCandidates.length - 1) setLogoIndex(p => p + 1);
              else setLogoIndex(logoCandidates.length);
            }}
          />
        ) : (
          <span className="text-xs font-bold text-slate-400">{logoFallback}</span>
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold truncate ${isConnected ? 'text-slate-100' : 'text-slate-200'}`}>
            {service.label}
          </span>
          {isConnected && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] text-slate-500 font-mono uppercase tracking-wide leading-none">
            {service.auth_type_label || formatAuthTypeLabel(service.auth_type)}
          </span>
          {(service.category_label || service.category) && (
            <span className="text-[11px] text-slate-600 leading-none">· {service.category_label || service.category}</span>
          )}
        </div>
      </div>

      {/* Action button */}
      {isConnected ? (
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onConfigure && onConfigure(service); }}
            className="shrink-0 p-1.5 rounded-lg text-slate-500 border border-slate-700/40 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-all duration-150"
            title="Configure preferences"
            aria-label={`Configure ${service.label}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRevoke && onRevoke(service); }}
            className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-700/40 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all duration-150"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onConnect && onConnect(service); }}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
            isNotConfigured
              ? 'text-amber-500/70 border border-amber-500/20 hover:bg-amber-500/5 hover:text-amber-400'
              : 'text-white bg-blue-600 hover:bg-blue-500 border border-transparent shadow-sm shadow-blue-900/50'
          }`}
          title={isNotConfigured ? 'Missing backend OAuth environment keys' : undefined}
        >
          {isNotConfigured ? 'Setup required' : 'Connect'}
        </button>
      )}
    </article>
  );
}

export default ServiceCard;
