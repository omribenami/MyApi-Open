import axios from 'axios';

// Create API client instance
const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use((config) => {
  const masterToken = localStorage.getItem('masterToken');
  if (masterToken) {
    config.headers.Authorization = `Bearer ${masterToken}`;
  }
  return config;
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle auth errors
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('masterToken');
      sessionStorage.removeItem('sessionToken');
      window.location.href = '/';
    }
    
    // Handle device approval errors (403 Forbidden)
    // These are expected and should be handled by the UI showing approval form
    if (error.response?.status === 403) {
      const errorData = error.response?.data || {};
      if (errorData.code === 'DEVICE_APPROVAL_REQUIRED' || errorData.error === 'device_not_approved') {
        // This is a device approval error, not a permission error
        // Allow it to propagate so UI can handle it appropriately
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

// OAuth endpoints
export const oauth = {
  // Get authorization URL for a service
  getAuthorizationUrl: (service, options = {}) =>
    apiClient.get(`/oauth/authorize/${service}`, { params: options }),

  // Get status of all connected services
  getStatus: () => 
    apiClient.get('/oauth/status'),

  // Disconnect a service
  disconnect: (service) => 
    apiClient.post(`/oauth/disconnect/${service}`),

  // Test OAuth token validity
  testToken: (service) => 
    apiClient.get(`/oauth/test/${service}`),
};

// Services/Connectors endpoints
export const services = {
  // Get all available services
  getAvailable: () => 
    apiClient.get('/services/available'),

  // Get connected services
  getConnected: () => 
    apiClient.get('/services'),

  // Connect a service (start OAuth flow)
  connect: (service) => 
    apiClient.post(`/oauth/authorize/${service}`),

  // Disconnect a service
  disconnect: (service) => 
    apiClient.post(`/oauth/disconnect/${service}`),

  // Get service details
  getServiceDetails: (service) => 
    apiClient.get(`/services/${service}`),

  // Update service configuration
  updateServiceConfig: (service, config) => 
    apiClient.put(`/services/${service}`, config),
};

export default apiClient;
