import { useState } from 'react';
import { getAuthTypeStyle, getStatusMeta } from '../utils/serviceCatalog';

function ServiceDetailModal({ service, onClose, onConnect, onRevoke }) {
  const [testingConnection, setTestingConnection] = useState(false);

  if (!service) return null;

  const statusMeta = getStatusMeta(service.status, service.notConfigured);

  const handleConnect = async () => {
    if (onConnect) {
      await onConnect(service);
      onClose();
    }
  };

  const handleRevoke = async () => {
    if (onRevoke) {
      await onRevoke(service);
      onClose();
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch(`/api/v1/services/${service.name}/test`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` },
      });

      if (response.ok) {
        alert('Connection looks healthy.');
      } else {
        const error = await response.json();
        alert(`Connection test failed: ${error.error}`);
      }
    } catch (err) {
      alert(`Error testing connection: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="service-modal-title">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              {service.icon ? (
                <img src={service.icon} alt="" className="w-9 h-9 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <span className="text-lg text-slate-200 font-semibold">{service.label?.slice(0, 1)}</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 id="service-modal-title" className="text-2xl font-bold text-white truncate">{service.label}</h2>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${statusMeta.className}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                  {statusMeta.label}
                </span>
                <span className={`px-2 py-1 rounded-md text-[11px] uppercase tracking-wide ${getAuthTypeStyle(service.auth_type)}`}>
                  {service.auth_type || 'unknown'}
                </span>
                <span className="px-2 py-1 rounded-md text-[11px] bg-slate-700 text-slate-300 border border-slate-600">
                  {service.category_label || service.category || 'Uncategorized'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300 text-2xl" aria-label="Close service details">✕</button>
        </div>

        {service.description && <p className="text-slate-300 mb-6">{service.description}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="rounded-lg bg-slate-900 border border-slate-700 p-4">
            <p className="text-xs uppercase text-slate-400 mb-1">API Base URL</p>
            <p className="text-sm text-slate-200 font-mono break-all" title={service.api_endpoint || 'Unknown'}>
              {service.api_endpoint || 'Not provided'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-700 p-4">
            <p className="text-xs uppercase text-slate-400 mb-1">Env Requirements</p>
            {service.env_requirements?.length ? (
              <div className="flex flex-wrap gap-2">
                {service.env_requirements.map((envKey) => (
                  <span key={envKey} className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200 border border-slate-600" title={`Required env var: ${envKey}`}>
                    {envKey}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No mandatory env keys documented for this connector.</p>
            )}
          </div>
        </div>

        {service.documentation_url && (
          <div className="mb-6">
            <a
              href={service.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center gap-2"
            >
              View integration docs →
            </a>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {service.status === 'connected' ? (
            <>
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleRevoke}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              {service.notConfigured ? 'Continue (shows setup guidance)' : 'Connect Service'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServiceDetailModal;
