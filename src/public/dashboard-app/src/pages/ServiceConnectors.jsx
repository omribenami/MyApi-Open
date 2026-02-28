import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useServicesStore } from '../stores/servicesStore';
import ServiceCard from '../components/ServiceCard';
import { startOAuthFlow, AVAILABLE_SERVICES } from '../utils/oauth';
import { oauth } from '../utils/apiClient';

function ServiceConnectors() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const {
    services,
    setServices,
    setIsLoading,
    isLoading,
    error,
    setError,
    openRevokeModal,
    closeRevokeModal,
    showRevokeModal,
    revokeServiceId,
  } = useServicesStore();

  const [isRevoking, setIsRevoking] = useState(false);
  const [connectError, setConnectError] = useState(null);

  useEffect(() => {
    fetchServices();
  }, [masterToken]);

  const fetchServices = async () => {
    if (!masterToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await oauth.getStatus();
      const statuses = response.data.services || [];

      // Build a map of API-returned services by name
      const apiMap = {};
      statuses.forEach((s) => {
        apiMap[s.name] = s;
      });

      // Merge AVAILABLE_SERVICES with the API response so all services always appear
      const merged = AVAILABLE_SERVICES.map((svc) => {
        const apiData = apiMap[svc.id];
        if (apiData) {
          return {
            name: svc.id,
            status: apiData.status || 'disconnected',
            lastSync: apiData.lastSync || null,
            scope: apiData.scope || null,
            enabled: apiData.enabled !== false, // treat missing as enabled
            notConfigured: apiData.enabled === false,
          };
        }
        // Service exists in frontend list but not returned by API at all
        return {
          name: svc.id,
          status: 'disconnected',
          lastSync: null,
          scope: null,
          enabled: false,
          notConfigured: true,
        };
      });

      setServices(merged);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      // On API failure, still show all available services as not-configured
      const fallback = AVAILABLE_SERVICES.map((svc) => ({
        name: svc.id,
        status: 'disconnected',
        lastSync: null,
        scope: null,
        enabled: false,
        notConfigured: true,
      }));
      setServices(fallback);
      setError('Could not load service status. Showing all available services.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (service) => {
    setConnectError(null);

    if (service.notConfigured) {
      setConnectError(
        `${service.name.charAt(0).toUpperCase() + service.name.slice(1)} OAuth is not yet configured on the server. Add credentials to the backend .env file to enable this integration.`
      );
      return;
    }

    setError(null);
    try {
      await startOAuthFlow(service.name);
    } catch (err) {
      console.error('OAuth flow error:', err);
      setError(`Failed to connect ${service.name}. Please try again.`);
    }
  };

  const handleRevoke = async (service) => {
    setIsRevoking(true);
    setError(null);

    try {
      await oauth.disconnect(service.name);
      closeRevokeModal();
      await fetchServices();
    } catch (err) {
      console.error('Failed to revoke service:', err);
      setError(`Failed to disconnect ${service.name}. Please try again.`);
    } finally {
      setIsRevoking(false);
    }
  };

  const connectedServices = services.filter((s) => s.status === 'connected');
  const disconnectedServices = services.filter((s) => s.status !== 'connected');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Services</h1>
        <p className="mt-2 text-slate-400">
          Connect external services to enrich your API and manage integrations
        </p>
      </div>

      {/* Connect Error (not-configured info) */}
      {connectError && (
        <div className="rounded-lg bg-amber-900 bg-opacity-30 border border-amber-700 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-amber-200">{connectError}</p>
            </div>
            <button onClick={() => setConnectError(null)} className="text-amber-400 hover:text-amber-300 text-lg leading-none">
              ×
            </button>
          </div>
        </div>
      )}

      {/* General Error Alert */}
      {error && !connectError && (
        <div className="rounded-lg bg-red-900 bg-opacity-30 border border-red-700 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-slate-400">Loading services...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Connected Services */}
          {connectedServices.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="inline-block h-2 w-2 bg-green-500 rounded-full"></span>
                  Connected Services
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {connectedServices.length} service{connectedServices.length !== 1 ? 's' : ''} connected
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {connectedServices.map((service) => (
                  <ServiceCard
                    key={service.name}
                    service={service}
                    onConnect={handleConnect}
                    onRevoke={() => openRevokeModal(service.name)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available / Disconnected Services */}
          {disconnectedServices.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="inline-block h-2 w-2 bg-slate-500 rounded-full"></span>
                  Available Services
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {disconnectedServices.length} service{disconnectedServices.length !== 1 ? 's' : ''} available to connect
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {disconnectedServices.map((service) => (
                  <ServiceCard
                    key={service.name}
                    service={service}
                    onConnect={handleConnect}
                    onRevoke={() => openRevokeModal(service.name)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Revoke Confirmation Modal */}
      {showRevokeModal && revokeServiceId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-2">Disconnect Service?</h2>
            <p className="text-slate-400 text-sm mb-4">
              Are you sure you want to disconnect{' '}
              <span className="font-semibold text-white capitalize">{revokeServiceId}</span>? This will remove its OAuth access.
            </p>
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 mb-6">
              <p className="text-sm text-red-200">Any integrations relying on this connection will stop working.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={closeRevokeModal}
                disabled={isRevoking}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(services.find((s) => s.name === revokeServiceId))}
                disabled={isRevoking}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isRevoking ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServiceConnectors;
