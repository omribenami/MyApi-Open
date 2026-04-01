import axios from 'axios';
import { clearAuthArtifacts, isLogoutInProgress, redirectToLoginOnce } from './authRuntime';
import { usePlanLimitStore } from '../stores/planLimitStore';

const rateLimitState = new Map();

const getBackoffMs = (url) => {
  const prev = rateLimitState.get(url) || { count: 0, until: 0 };
  const nextCount = Math.min(prev.count + 1, 6);
  const backoffMs = Math.min(1000 * (2 ** nextCount), 60000);
  const jitter = Math.floor(Math.random() * 250);
  const until = Date.now() + backoffMs + jitter;
  rateLimitState.set(url, { count: nextCount, until });
  return until - Date.now();
};

const clearBackoff = (url) => {
  rateLimitState.delete(url);
};

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
  const rate = rateLimitState.get(fullUrl);
  if (rate?.until && Date.now() < rate.until) {
    const err = new Error('Rate limited: backing off');
    err.code = 'MYAPI_RATE_LIMIT_BACKOFF';
    err.retryAfterMs = rate.until - Date.now();
    return Promise.reject(err);
  }

  if (isLogoutInProgress()) {
    const err = new Error('Logout in progress');
    err.code = 'MYAPI_LOGOUT_IN_PROGRESS';
    return Promise.reject(err);
  }

  let masterToken = null;
  let sessionToken = null;
  try {
    masterToken = localStorage.getItem('masterToken');
    sessionToken = sessionStorage.getItem('sessionToken');
  } catch {
    // Ignore storage corruption and continue with cookie/session auth only.
  }
  if (!sessionToken && masterToken) {
    config.headers.Authorization = `Bearer ${masterToken}`;
  }

  // Multi-tenancy: Add X-Workspace-ID header for workspace-scoped API calls
  try {
    const currentWorkspaceId = localStorage.getItem('currentWorkspace');
    if (currentWorkspaceId) {
      config.headers['X-Workspace-ID'] = currentWorkspaceId;
    }
  } catch (storageErr) {
    console.error('[API] Failed to access localStorage:', storageErr.message);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const fullUrl = `${response.config?.baseURL || ''}${response.config?.url || ''}`;
    clearBackoff(fullUrl);
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const fullUrl = `${error.config?.baseURL || ''}${error.config?.url || ''}`;

    if (status === 429) {
      const retryAfterHeader = Number(error.response?.headers?.['retry-after'] || 0);
      const retryAfterMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : getBackoffMs(fullUrl);
      error.retryAfterMs = retryAfterMs;
      return Promise.reject(error);
    }

    if ((status === 401 || status === 403) && !isLogoutInProgress()) {
      const errorData = error.response?.data || {};

      // Plan limit — show upgrade modal instead of redirecting to login
      if (status === 403 && typeof errorData.error === 'string' && errorData.error.startsWith('Plan limit reached')) {
        usePlanLimitStore.getState().show({
          plan: errorData.plan || null,
          limit: errorData.limit || null,
          errorMessage: errorData.error,
        });
        return Promise.reject(error);
      }

      if (status === 403 && (errorData.code === 'DEVICE_APPROVAL_REQUIRED' || errorData.error === 'device_not_approved')) {
        return Promise.reject(error);
      }
      clearAuthArtifacts();
      redirectToLoginOnce();
    }

    return Promise.reject(error);
  }
);

export const oauth = {
  getAuthorizationUrl: (service, options = {}) => apiClient.get(`/oauth/authorize/${service}`, { params: options }),
  getStatus: () => apiClient.get('/oauth/status'),
  disconnect: (service) => apiClient.post(`/oauth/disconnect/${service}`),
  testToken: (service) => apiClient.get(`/oauth/test/${service}`),
};

export const services = {
  getAvailable: () => apiClient.get('/services/available'),
  getConnected: () => apiClient.get('/services'),
  connect: (service) => apiClient.post(`/oauth/authorize/${service}`),
  disconnect: (service) => apiClient.post(`/oauth/disconnect/${service}`),
  getServiceDetails: (service) => apiClient.get(`/services/${service}`),
  updateServiceConfig: (service, config) => apiClient.put(`/services/${service}`, config),
};

export default apiClient;
