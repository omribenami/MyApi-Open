import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useServicesStore } from '../stores/servicesStore';
import ServiceCard from '../components/ServiceCard';
import RevokeConfirmationModal from '../components/RevokeConfirmationModal';
import { startOAuthFlow, getServiceById, AVAILABLE_SERVICES } from '../utils/oauth';
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
    openConnectModal,
    closeConnectModal,
    openRevokeModal,
    closeRevokeModal,
    showRevokeModal,
  } = useServicesStore();

  const [isRevoking, setIsRevoking] = useState(false);

  // Fetch connected services on component mount
  useEffect(() => {
    fetchServices();
  }, [masterToken]);

  const fetchServices = async () => {
    if (!masterToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await oauth.getStatus();
      const statuses = response.data.data || [];

      // Transform API response to component state
      const formattedServices = statuses.map((status) => ({
        name: status.name,
        status: status.status,
        lastSync: status.lastSync,
        scope: status.scope,
        enabled: status.enabled,
      }));

      setServices(formattedServices);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError('Failed to load services. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (service) => {
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

  // Get connected services
  const connectedServices = services.filter((s) => s.status === 'connected');
  const disconnectedServices = services.filter((s) => s.status !== 'connected');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Service Connectors</h1>
        <p className="mt-2 text-slate-400">
          Connect external services to enrich your API and manage integrations
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg bg-red-900 bg-opacity-30 border border-red-700 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-200">{error}</h3>
              <button
                onClick={fetchServices}
                className="mt-2 text-xs font-medium text-red-300 hover:text-red-200 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
            <p className="mt-4 text-slate-400">Loading services...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Connected Services Section */}
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

          {/* Available Services Section */}
          {disconnectedServices.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="inline-block h-2 w-2 bg-amber-500 rounded-full"></span>
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

          {/* Empty State */}
          {services.length === 0 && (
            <div className="rounded-lg bg-slate-800 border-2 border-dashed border-slate-700 p-12 text-center">
              <div className="text-4xl mb-4">🔗</div>
              <h3 className="text-lg font-semibold text-white mb-2">No services configured</h3>
              <p className="text-slate-400 mb-6">
                Start by connecting your first service to integrate with external platforms
              </p>
              <button
                onClick={fetchServices}
                className="px-4 py-2 rounded-lg text-sm font-medium text-blue-300 bg-blue-900 bg-opacity-20 hover:bg-opacity-40 border border-blue-700 transition-colors"
              >
                Refresh Services
              </button>
            </div>
          )}
        </>
      )}

      {/* Revoke Confirmation Modal */}
      {showRevokeModal && (
        <RevokeConfirmationModal
          service={services.find((s) => s.status === 'connected')}
          onConfirm={handleRevoke}
          isLoading={isRevoking}
          error={error}
        />
      )}
    </div>
  );
}

export default ServiceConnectors;
