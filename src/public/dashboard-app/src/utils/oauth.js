import { oauth } from './apiClient';

export async function startOAuthFlow(service, options = {}) {
  try {
    sessionStorage.setItem('oauth_service', service);
    if (options.mode) sessionStorage.setItem('oauth_mode', options.mode);
    if (options.returnTo) sessionStorage.setItem('oauth_returnTo', options.returnTo);

    // Build query params
    const params = new URLSearchParams();
    if (options.mode) params.append('mode', options.mode);
    if (options.returnTo) params.append('returnTo', options.returnTo);
    params.append('redirect', '1'); // Force server-side redirect

    // Fetch the auth URL first to verify it's working
    const endpoint = `/api/v1/oauth/authorize/${service}?${params.toString()}`;
    console.log(`[OAuth] Starting OAuth flow for ${service}`);
    console.log(`[OAuth] Endpoint: ${endpoint}`);
    
    // Try to fetch with redirect mode
    const response = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow' // Important: follow redirects
    });
    
    console.log(`[OAuth] Response status: ${response.status}`);
    console.log(`[OAuth] Response URL: ${response.url}`);
    
    // If fetch followed the redirect, we're already on the OAuth provider page
    // If not, manually set location
    if (response.url && response.url.includes('github.com')) {
      console.log(`[OAuth] Already on GitHub, no redirect needed`);
    } else {
      // Fallback: direct navigation
      console.log(`[OAuth] Direct navigation to: ${endpoint}`);
      window.location.href = endpoint;
    }
  } catch (error) {
    console.error(`Failed to start OAuth flow for ${service}:`, error);
    throw error;
  }
}

export function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const service = urlParams.get('oauth_service');
  const status = urlParams.get('oauth_status');
  const error = urlParams.get('error');
  const mode = urlParams.get('mode');

  if (!service) return null;

  return { service, status, error, mode };
}

export function clearOAuthSession() {
  sessionStorage.removeItem('oauth_service');
  sessionStorage.removeItem('oauth_mode');
}

export const AVAILABLE_SERVICES = [
  { id: 'google', name: 'Google Workspace', icon: '🔵', color: '#4285F4', description: 'Sign in with Google Workspace and connect Gmail/Calendar', scopes: ['email', 'profile', 'gmail', 'calendar'] },
  { id: 'github', name: 'GitHub', icon: '🐙', color: '#333333', description: 'Connect to GitHub repositories and account', scopes: ['repo', 'user'] },
  { id: 'facebook', name: 'Facebook', icon: 'f', color: '#1877F2', description: 'Connect to Facebook account', scopes: ['email', 'public_profile'] },
  { id: 'instagram', name: 'Instagram', icon: '📷', color: '#E4405F', description: 'Connect your Instagram business profile', scopes: ['user_profile', 'user_media'] },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#111827', description: 'Connect to TikTok account', scopes: ['user.info.basic'] },
  { id: 'twitter', name: 'X / Twitter', icon: '𝕏', color: '#111827', description: 'Connect to X account', scopes: ['tweet.read', 'users.read'] },
  { id: 'reddit', name: 'Reddit', icon: '👽', color: '#FF4500', description: 'Connect to Reddit account', scopes: ['identity', 'read'] },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', color: '#0A66C2', description: 'Connect to LinkedIn profile and pages', scopes: ['r_liteprofile', 'w_member_social'] },
  { id: 'slack', name: 'Slack', icon: '💬', color: '#36C5F0', description: 'Connect to Slack workspace and channels', scopes: ['chat:write', 'chat:read'] },
  { id: 'discord', name: 'Discord', icon: '🎮', color: '#5865F2', description: 'Connect to Discord server and channels', scopes: ['identify', 'email'] },
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: '#25D366', description: 'Connect to WhatsApp Business Account', scopes: ['messages', 'contacts'] },
];

export function getServiceById(serviceId) {
  return AVAILABLE_SERVICES.find((s) => s.id === serviceId);
}

export function formatServiceStatus(status) {
  const statusMap = {
    connected: { label: 'Connected', color: '#10B981', icon: '✓' },
    disconnected: { label: 'Disconnected', color: '#6B7280', icon: '✕' },
    pending: { label: 'Pending', color: '#F59E0B', icon: '⏳' },
    error: { label: 'Error', color: '#EF4444', icon: '!' },
  };

  return statusMap[status] || statusMap.disconnected;
}

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
