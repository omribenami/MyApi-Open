import { useEffect, useMemo, useState } from 'react';
import { formatAuthTypeLabel, getAuthTypeStyle, getStatusMeta } from '../utils/serviceCatalog';

function ServiceCard({ service, onConnect, onRevoke, onDetails, onConfigure }) {
  const statusMeta = getStatusMeta(service.status, service.notConfigured);

  const logoFallback = (service.label || service.name || '?').slice(0, 1).toUpperCase();
  const logoCandidates = useMemo(() => {
    const candidates = [service.icon, ...(service.logoFallbacks || [])].filter(Boolean);
    return Array.from(new Set(candidates));
  }, [service.icon, service.logoFallbacks]);

  const [logoIndex, setLogoIndex] = useState(0);

  useEffect(() => {
    setLogoIndex(0);
  }, [service.name, service.icon, service.logoFallbacks]);

  const activeLogo = logoCandidates[logoIndex] || null;

  return (
    <article
      className="group bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/60 rounded-2xl hover:border-slate-600 hover:shadow-xl transition-all duration-300 overflow-hidden backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={() => onDetails && onDetails(service)}
        className="w-full text-left p-6"
        aria-label={`View details for ${service.label}`}
      >
        <div className="flex items-start gap-4">
          <div
            className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/60 flex items-center justify-center overflow-hidden shrink-0 group-hover:shadow-lg group-hover:shadow-blue-500/10 transition-all duration-300"
            role="img"
            aria-label={`${service.label} logo`}
          >
            {activeLogo ? (
              <img
                src={activeLogo}
                alt=""
                aria-hidden="true"
                className="w-8 h-8 object-contain"
                loading="lazy"
                onError={() => {
                  if (logoIndex < logoCandidates.length - 1) {
                    setLogoIndex((prev) => prev + 1);
                  } else {
                    setLogoIndex(logoCandidates.length);
                  }
                }}
              />
            ) : (
              <span className="text-lg font-bold text-slate-200" aria-hidden="true">{logoFallback}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-semibold text-white truncate group-hover:text-blue-300 transition-colors">{service.label}</h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium flex-shrink-0 ${statusMeta.className}`}>
                  <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} aria-hidden="true" />
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{service.description}</p>
            </div>
            
            {service.status === 'connected' && service.lastApiCall && (
              <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                <span>📡</span>
                Last API call: {new Date(service.lastApiCall).toLocaleString()}
              </p>
            )}
            
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-xs uppercase font-semibold tracking-wide ${getAuthTypeStyle(service.auth_type)}`}>
                {service.auth_type_label || formatAuthTypeLabel(service.auth_type)}
              </span>
              {service.category_label || service.category ? (
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/40 text-slate-300 border border-slate-600/50">
                  {service.category_label || service.category}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>

      <div className="border-t border-slate-700/50 bg-gradient-to-r from-slate-900/40 to-transparent px-6 py-4 flex gap-2">
        {service.status === 'connected' ? (
          service.auth_type === 'api_key' ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfigure && onConfigure(service);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-purple-300 bg-gradient-to-r from-purple-600/30 to-purple-600/10 border border-purple-500/50 hover:from-purple-600/50 hover:to-purple-600/30 hover:border-purple-500/70 transition-all duration-200"
              >
                ⚙️ Configure Key
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnect(service);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-blue-300 bg-gradient-to-r from-blue-600/30 to-blue-600/10 border border-blue-500/50 hover:from-blue-600/50 hover:to-blue-600/30 hover:border-blue-500/70 transition-all duration-200"
              >
                Update Key
              </button>
            </>
          ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConfigure && onConfigure(service);
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-purple-300 bg-gradient-to-r from-purple-600/30 to-purple-600/10 border border-purple-500/50 hover:from-purple-600/50 hover:to-purple-600/30 hover:border-purple-500/70 transition-all duration-200 hover:shadow-lg hover:shadow-purple-600/10"
            >
              ⚙️ Configure
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRevoke(service);
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-red-300 bg-gradient-to-r from-red-900/30 to-red-900/10 border border-red-700/50 hover:from-red-900/50 hover:to-red-900/30 hover:border-red-600/70 transition-all duration-200 hover:shadow-lg hover:shadow-red-600/10"
            >
              Disconnect
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConnect(service);
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-blue-300 bg-gradient-to-r from-blue-600/30 to-blue-600/10 border border-blue-500/50 hover:from-blue-600/50 hover:to-blue-600/30 hover:border-blue-500/70 transition-all duration-200 hover:shadow-lg hover:shadow-blue-600/10"
            >
              Reconnect
            </button>
          </>
          )
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConnect(service);
            }}
            className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-200 ${
              service.notConfigured
                ? 'text-amber-300 bg-gradient-to-r from-amber-600/40 to-amber-600/10 border-amber-700/50 hover:from-amber-600/60 hover:to-amber-600/30 hover:border-amber-600/70 hover:shadow-lg hover:shadow-amber-600/10'
                : 'text-white bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500/70 hover:from-blue-500 hover:to-blue-600 hover:border-blue-400/70 hover:shadow-lg hover:shadow-blue-600/30'
            }`}
            title={service.notConfigured ? 'Missing backend OAuth env keys' : undefined}
          >
            {service.notConfigured ? '⚙️ Setup Required' : '➕ Connect'}
          </button>
        )}
      </div>
    </article>
  );
}

export default ServiceCard;
