/**
 * Maps service names to their OAuth providers
 * Some services (like googleanalytics, gmail, googledrive) use the same OAuth provider (google)
 */
const OAUTH_PROVIDER_MAP = {
  // Google services
  'google': 'google',
  'googleanalytics': 'google',
  'googleanalytics4': 'google',
  'gmail': 'google',
  'googledrive': 'google',
  'googlesheets': 'google',
  'googleslides': 'google',
  'googlecalendar': 'google',
  'googlephotos': 'google',
  'googlecontacts': 'google',
  'youtubedatapi': 'google',
  
  // Other OAuth providers
  'github': 'github',
  'slack': 'slack',
  'discord': 'discord',
  'whatsapp': 'whatsapp',
  'facebook': 'facebook',
  'instagram': 'instagram',
  'tiktok': 'tiktok',
  'twitter': 'twitter',
  'x': 'twitter', // X/Twitter alias
  'reddit': 'reddit',
  'linkedin': 'linkedin',
  'notion': 'notion',
  'microsoft365': 'microsoft365',
  'dropbox': 'dropbox',
  'trello': 'trello',
  'zoom': 'zoom',
  'hubspot': 'hubspot',
  'salesforce': 'salesforce',
  'jira': 'jira',
};

/**
 * Get the OAuth provider for a given service name
 * @param {string} serviceName - The service name (e.g., "googleanalytics", "gmail", "twitter")
 * @returns {string} The OAuth provider name (e.g., "google", "twitter")
 */
export function getOAuthProvider(serviceName) {
  if (!serviceName) return null;
  const provider = OAUTH_PROVIDER_MAP[serviceName.toLowerCase()];
  return provider || serviceName.toLowerCase();
}

/**
 * Check if a service uses OAuth authentication
 * @param {string} serviceName - The service name
 * @returns {boolean} True if the service uses OAuth
 */
export function usesOAuth(serviceName) {
  return !!OAUTH_PROVIDER_MAP[serviceName?.toLowerCase()];
}

/**
 * Get all supported OAuth providers
 * @returns {Set} Set of unique OAuth provider names
 */
export function getSupportedOAuthProviders() {
  return new Set(Object.values(OAUTH_PROVIDER_MAP));
}
