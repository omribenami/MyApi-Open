import { oauth } from './apiClient';

/**
 * Start OAuth flow for a service
 */
export async function startOAuthFlow(service) {
  try {
    const response = await oauth.getAuthorizationUrl(service);
    const { authUrl } = response.data;

    // Store the service in sessionStorage so we can handle it in the callback
    sessionStorage.setItem('oauth_service', service);

    // Redirect to OAuth provider
    window.location.href = authUrl;
  } catch (error) {
    console.error(`Failed to start OAuth flow for ${service}:`, error);
    throw error;
  }
}

/**
 * Handle OAuth callback
 * This is called when the user is redirected back from the OAuth provider
 */
export function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const service = urlParams.get('oauth_service');
  const status = urlParams.get('oauth_status');
  const error = urlParams.get('error');

  if (!service) {
    return null;
  }

  return {
    service,
    status, // 'connected' or 'error'
    error,
  };
}

/**
 * Clear OAuth session data
 */
export function clearOAuthSession() {
  sessionStorage.removeItem('oauth_service');
}

/**
 * Get available OAuth services
 */
export const AVAILABLE_SERVICES = [
  {
    id: 'google',
    name: 'Google',
    icon: '🔵',
    color: '#4285F4',
    description: 'Connect to Google services (Gmail, Calendar, Drive)',
    scopes: ['email', 'profile', 'gmail', 'calendar'],
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    color: '#333333',
    description: 'Connect to GitHub repositories and account',
    scopes: ['repo', 'user'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'f',
    color: '#1877F2',
    description: 'Connect to Facebook account',
    scopes: ['email', 'public_profile'],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    color: '#36C5F0',
    description: 'Connect to Slack workspace and channels',
    scopes: ['chat:write', 'chat:read'],
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    color: '#5865F2',
    description: 'Connect to Discord server and channels',
    scopes: ['identify', 'email'],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '💬',
    color: '#25D366',
    description: 'Connect to WhatsApp Business Account',
    scopes: ['messages', 'contacts'],
  },
];

/**
 * Get service details by ID
 */
export function getServiceById(serviceId) {
  return AVAILABLE_SERVICES.find((s) => s.id === serviceId);
}

/**
 * Format service status for display
 */
export function formatServiceStatus(status) {
  const statusMap = {
    connected: { label: 'Connected', color: '#10B981', icon: '✓' },
    disconnected: { label: 'Disconnected', color: '#6B7280', icon: '✕' },
    pending: { label: 'Pending', color: '#F59E0B', icon: '⏳' },
    error: { label: 'Error', color: '#EF4444', icon: '!' },
  };

  return statusMap[status] || statusMap.disconnected;
}

/**
 * Format last synced timestamp
 */
export function formatLastSynced(timestamp) {
  if (!timestamp) return 'Never';

  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}
