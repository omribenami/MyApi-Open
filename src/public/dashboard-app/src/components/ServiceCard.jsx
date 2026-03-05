import { getAuthTypeStyle, getStatusMeta } from '../utils/serviceCatalog';

function ServiceCard({ service, onConnect, onRevoke, onDetails, compact = false }) {
  const statusMeta = getStatusMeta(service.status, service.notConfigured);

  const cardClass = compact
    ? 'p-4'
    : 'p-5';

  const logoFallback = (service.label || service.name || '?').slice(0, 1).toUpperCase();

  return (
    <article
      className="bg-slate-800 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors focus-within:ring-2 focus-within:ring-blue-500/40"
    >
      <button
        type="button"
        onClick={() => onDetails && onDetails(service)}
        className={`w-full text-left ${cardClass}`}
        aria-label={`View details for ${service.label}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
            {service.icon ? (
              <img
                src={service.icon}
                alt=""
                className="w-7 h-7 object-contain"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement.textContent = logoFallback;
                }}
              />
            ) : (
              <span className="text-sm font-semibold text-slate-200">{logoFallback}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2 items-center">
              <h3 className="text-base font-semibold text-white truncate">{service.label}</h3>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${statusMeta.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} aria-hidden="true" />
                {statusMeta.label}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{service.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`px-2 py-1 rounded-md text-[11px] uppercase tracking-wide ${getAuthTypeStyle(service.auth_type)}`}>
                {service.auth_type || 'unknown'}
              </span>
              {service.category_label || service.category ? (
                <span className="px-2 py-1 rounded-md text-[11px] bg-slate-700 text-slate-300 border border-slate-600">
                  {service.category_label || service.category}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>

      <div className="border-t border-slate-700 p-4 flex gap-2">
        {service.status === 'connected' ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRevoke(service);
              }}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-red-300 bg-red-900/20 hover:bg-red-900/40 border border-red-700 transition-colors"
            >
              Disconnect
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onConnect(service);
              }}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-blue-200 bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/60 transition-colors"
            >
              Reconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConnect(service);
            }}
            className={`w-full px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              service.notConfigured
                ? 'text-amber-300 bg-amber-900/20 border-amber-700 hover:bg-amber-900/35'
                : 'text-white bg-blue-600 hover:bg-blue-700 border-blue-500'
            }`}
            title={service.notConfigured ? 'Missing backend OAuth env keys' : undefined}
          >
            {service.notConfigured ? 'Setup Required' : 'Connect'}
          </button>
        )}
      </div>
    </article>
  );
}

export default ServiceCard;
