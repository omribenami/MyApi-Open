import { useState } from 'react';

function ServiceDetailModal({ service, onClose, onConnect, onRevoke }) {
  const [testingConnection, setTestingConnection] = useState(false);

  if (!service) return null;

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
        headers: { 'Authorization': `Bearer ${localStorage.getItem('sessionToken')}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`✅ Connection successful!\n\n${JSON.stringify(data, null, 2)}`);
      } else {
        const error = await response.json();
        alert(`❌ Connection failed: ${error.error}`);
      }
    } catch (err) {
      alert(`❌ Error testing connection: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            {service.icon && (
              <img 
                src={service.icon} 
                alt={service.label}
                className="w-16 h-16 rounded"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">{service.label}</h2>
              <p className="text-sm text-slate-400 mt-1">Category: {service.category_label || service.category}</p>
              <p className="text-xs text-slate-500 mt-1">Auth: {service.auth_type?.toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Description */}
        {service.description && (
          <div className="mb-6">
            <p className="text-slate-300">{service.description}</p>
          </div>
        )}

        {/* Service Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-700 rounded-lg">
          <div>
            <p className="text-xs text-slate-400 uppercase">API Endpoint</p>
            <p className="text-sm text-slate-200 font-mono break-all">{service.api_endpoint}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Auth Type</p>
            <p className="text-sm text-slate-200">{service.auth_type}</p>
          </div>
        </div>

        {/* API Methods */}
        {service.methods && service.methods.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Available API Methods</h3>
            <div className="space-y-2">
              {service.methods.map((method, idx) => (
                <div key={idx} className="p-3 bg-slate-700 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-mono">
                      {method.http_method}
                    </span>
                    <span className="text-slate-300 font-mono">{method.endpoint}</span>
                  </div>
                  {method.description && (
                    <p className="text-slate-400 text-xs mt-1">{method.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documentation Link */}
        {service.documentation_url && (
          <div className="mb-6">
            <a
              href={service.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2"
            >
              📖 View Official Documentation
              <span>→</span>
            </a>
          </div>
        )}

        {/* Status */}
        <div className="mb-6 p-4 bg-slate-700 rounded-lg">
          <p className="text-sm">
            <span className="text-slate-400">Status: </span>
            <span className={`font-semibold ${
              service.status === 'connected' ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {service.status === 'connected' ? '🟢 Connected' : '⭕ Not Connected'}
            </span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {service.status === 'connected' ? (
            <>
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {testingConnection ? 'Testing...' : '🧪 Test Connection'}
              </button>
              <button
                onClick={handleRevoke}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                🔌 Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              ✨ Connect Service
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServiceDetailModal;
