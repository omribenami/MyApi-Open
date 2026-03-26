import { useState, useEffect } from 'react';
import { formatAuthTypeLabel, getAuthTypeStyle, getStatusMeta } from '../utils/serviceCatalog';

function ServiceDetailModal({ service, onClose, onConnect, onRevoke }) {
  const [testingConnection, setTestingConnection] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [testRecipient, setTestRecipient] = useState('');

  const isEmailService = service?.name === 'email';

  useEffect(() => {
    if (!isEmailService) {
      setEmailStatus(null);
      return;
    }

    const loadEmailStatus = async () => {
      try {
        const response = await fetch('/api/v1/email/status', {
          headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` },
        });
        const data = await response.json();
        if (response.ok) setEmailStatus(data);
      } catch {
        // Best-effort status load.
      }
    };

    loadEmailStatus();
  }, [isEmailService]);

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
      const endpoint = isEmailService ? '/api/v1/email/test' : `/api/v1/services/${service.name}/test`;
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` },
      });

      const payload = await response.json();
      if (response.ok && payload.success !== false) {
        alert(isEmailService ? 'Outbound email connection is healthy.' : 'Connection looks healthy.');
        if (isEmailService) {
          const statusRes = await fetch('/api/v1/email/status', {
            headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` },
          });
          if (statusRes.ok) setEmailStatus(await statusRes.json());
        }
      } else {
        alert(`Connection test failed: ${payload.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error testing connection: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestEmail = async () => {
    const to = testRecipient.trim();
    if (!to || !to.includes('@')) {
      alert('Please enter a valid recipient email address.');
      return;
    }

    setSendingTest(true);
    try {
      const response = await fetch('/api/v1/email/send-test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to }),
      });
      const payload = await response.json();
      if (response.ok && payload.success !== false) {
        alert(`Test email sent to ${to}`);
      } else {
        alert(`Send failed: ${payload.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Failed to send test email: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="service-modal-title">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-5 min-w-0 flex-1">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/60 flex items-center justify-center overflow-hidden shrink-0 shadow-lg shadow-slate-900/50">
              {service.icon ? (
                <img src={service.icon} alt="" className="w-9 h-9 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <span className="text-2xl text-slate-200 font-bold">{service.label?.slice(0, 1)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="service-modal-title" className="text-3xl font-bold text-white truncate">{service.label}</h2>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${statusMeta.className}`}>
                  <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                  {statusMeta.label}
                </span>
                <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide ${getAuthTypeStyle(service.auth_type)}`}>
                  {service.auth_type_label || formatAuthTypeLabel(service.auth_type)}
                </span>
                <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-200 border border-slate-600/50">
                  {service.category_label || service.category || 'Uncategorized'}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 text-2xl transition-colors flex-shrink-0" 
            aria-label="Close service details"
          >
            ✕
          </button>
        </div>

        {service.description && (
          <p className="text-slate-300 text-base leading-relaxed mb-8 bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
            {service.description}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="rounded-xl bg-slate-900/40 border border-slate-700/50 backdrop-blur-sm p-5">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-3 tracking-wide">🔗 API Base URL</p>
            <p className="text-sm text-slate-200 font-mono break-all bg-slate-950/50 rounded p-3 border border-slate-700/30" title={service.api_endpoint || 'Unknown'}>
              {service.api_endpoint || '—'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/40 border border-slate-700/50 backdrop-blur-sm p-5">
            <p className="text-xs uppercase font-semibold text-slate-400 mb-3 tracking-wide">⚙️ Env Requirements</p>
            {service.env_requirements?.length ? (
              <div className="flex flex-wrap gap-2">
                {service.env_requirements.map((envKey) => (
                  <span 
                    key={envKey} 
                    className="text-xs px-3 py-2 rounded-lg bg-slate-700/40 text-slate-200 border border-slate-600/50 font-mono" 
                    title={`Required env var: ${envKey}`}
                  >
                    {envKey}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No mandatory env keys documented for this connector.</p>
            )}
          </div>
        </div>

        {isEmailService && emailStatus && (
          <div className="mb-8 p-4 rounded-xl bg-slate-900/40 border border-slate-700/60 space-y-3">
            <p className="text-sm font-semibold text-slate-200">Outbound Email Status</p>
            <p className="text-xs text-slate-400">
              Provider: <span className="text-slate-200 font-mono">{emailStatus.provider?.provider || 'smtp'}</span> ·
              Queue pending: <span className="text-slate-200"> {emailStatus.queue?.pending ?? 0}</span> ·
              Failed: <span className="text-slate-200"> {emailStatus.queue?.failed ?? 0}</span>
            </p>
            {emailStatus.provider?.missing?.length > 0 && (
              <p className="text-xs text-amber-300">Missing config: {emailStatus.provider.missing.join(', ')}</p>
            )}
            {emailStatus.queue?.lastFailure?.failedReason && (
              <p className="text-xs text-red-300">Last failure: {emailStatus.queue.lastFailure.failedReason}</p>
            )}
          </div>
        )}

        {service.documentation_url && (
          <div className="mb-8 p-4 rounded-xl bg-blue-900/20 border border-blue-700/40">
            <a
              href={service.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 text-sm inline-flex items-center gap-2 font-medium transition-colors"
            >
              📚 View integration documentation
              <span className="text-lg">→</span>
            </a>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {isEmailService ? (
            <>
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {testingConnection ? '⏳ Testing...' : '✓ Test Connection'}
              </button>
              <input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="test@domain.com"
                className="flex-1 px-4 py-3 bg-slate-900/80 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleSendTestEmail}
                disabled={sendingTest}
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {sendingTest ? 'Sending…' : 'Send Test Email'}
              </button>
            </>
          ) : service.status === 'connected' ? (
            service.auth_type === 'api_key' ? (
              <>
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {testingConnection ? '⏳ Testing...' : '✓ Test Connection'}
                </button>
                <button
                  onClick={handleConnect}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-lg transition-all duration-200"
                >
                  🔐 Update API Key
                </button>
              </>
            ) : (
            <>
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30"
              >
                {testingConnection ? '⏳ Testing...' : '✓ Test Connection'}
              </button>
              <button
                onClick={handleRevoke}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-red-600/20 hover:shadow-red-600/30"
              >
                🔌 Disconnect
              </button>
            </>
            )
          ) : (
            <button
              onClick={handleConnect}
              className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30"
            >
              {service.notConfigured ? '⚙️ Continue (Setup Guidance)' : '➕ Connect Service'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServiceDetailModal;
