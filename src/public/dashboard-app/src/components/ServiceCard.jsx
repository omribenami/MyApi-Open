import { formatServiceStatus, formatLastSynced, getServiceById } from '../utils/oauth';
import { useServicesStore } from '../stores/servicesStore';

function ServiceCard({ service, onConnect, onRevoke }) {
  const serviceInfo = getServiceById(service.name);
  const status = formatServiceStatus(service.status);
  const lastSynced = formatLastSynced(service.lastSync);
  const { selectedService } = useServicesStore();
  const isSelected = selectedService?.name === service.name;

  if (!serviceInfo) {
    return null;
  }

  return (
    <div
      className={`relative bg-slate-800 border-2 rounded-lg overflow-hidden transition-all duration-200 ${
        isSelected
          ? 'border-blue-500 shadow-lg shadow-blue-500/20'
          : 'border-slate-700 hover:border-slate-600'
      }`}
    >
      {/* Header */}
      <div className="p-6">
        {/* Service Info */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            {/* Logo Image or Fallback Icon */}
            {service.icon ? (
              <img 
                src={service.icon} 
                alt={service.label || service.name}
                className="w-12 h-12 mr-4 rounded"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><circle cx="12" cy="12" r="10"/></svg>';
                }}
              />
            ) : (
              <div className="text-4xl mr-4">{serviceInfo.icon}</div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-white">{service.label || serviceInfo.name}</h3>
              <p className="text-sm text-slate-400 mt-1">{service.description || serviceInfo.description}</p>
            </div>
          </div>
          <div className="ml-4">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: status.color + '20',
                color: status.color,
                border: `1px solid ${status.color}40`,
              }}
            >
              <span className="mr-1">{status.icon}</span>
              {status.label}
            </span>
          </div>
        </div>

        {/* Metadata */}
        {service.status === 'connected' && (
          <div className="space-y-2 mb-4">
            <div className="text-xs text-slate-400">
              <span className="font-medium">Last synced:</span> {lastSynced}
            </div>
            {service.scope && (
              <div className="text-xs text-slate-400">
                <span className="font-medium">Scopes:</span> {service.scope}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/50 flex gap-3">
        {service.status === 'connected' ? (
          <>
            <button
              onClick={() => onRevoke(service)}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-red-300 bg-red-900 bg-opacity-20 hover:bg-opacity-40 border border-red-700 hover:border-red-600 transition-colors"
            >
              Disconnect
            </button>
            <button
              onClick={() => onConnect(service)}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-blue-300 bg-blue-900 bg-opacity-20 hover:bg-opacity-40 border border-blue-700 hover:border-blue-600 transition-colors"
            >
              Refresh
            </button>
          </>
        ) : service.notConfigured ? (
          <button
            onClick={() => onConnect(service)}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-slate-400 bg-slate-700 border border-slate-600 cursor-pointer hover:border-amber-600 hover:text-amber-300 transition-colors"
            title="OAuth credentials not configured on server"
          >
            Connect — Not yet configured
          </button>
        ) : (
          <button
            onClick={() => onConnect(service)}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-500 transition-colors"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

export default ServiceCard;
