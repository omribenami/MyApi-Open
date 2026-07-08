/**
 * Maps service names to their OAuth providers.
 * Some services share the same provider (for example Gmail and Google Drive use Google).
 */
const OAUTH_PROVIDER_MAP = {
  google: 'google',
  googleanalytics: 'google',
  googleanalytics4: 'google',
  gmail: 'google',
  googledrive: 'google',
  googlesheets: 'google',
  googleslides: 'google',
  googlecalendar: 'google',
  googlephotos: 'google',
  googlecontacts: 'google',
  youtubedatapi: 'google',

  github: 'github',
  slack: 'slack',
  discord: 'discord',
  whatsapp: 'whatsapp',
  facebook: 'facebook',
  instagram: 'instagram',
  tiktok: 'tiktok',
  twitter: 'twitter',
  x: 'twitter',
  reddit: 'reddit',
  linkedin: 'linkedin',
  linkedin_pages: 'linkedin_pages',
  notion: 'notion',
  microsoft365: 'microsoft365',
  dropbox: 'dropbox',
  trello: 'trello',
  zoom: 'zoom',
  hubspot: 'hubspot',
  salesforce: 'salesforce',
  jira: 'jira',
};

export function getOAuthProvider(serviceName) {
  if (!serviceName) return null;
  const normalized = serviceName.toLowerCase();
  if (normalized.startsWith('composio__')) return 'composio';
  const provider = OAUTH_PROVIDER_MAP[normalized];
  return provider || normalized;
}

export function usesOAuth(serviceName) {
  return !!OAUTH_PROVIDER_MAP[serviceName?.toLowerCase()];
}

export function getSupportedOAuthProviders() {
  return new Set(Object.values(OAUTH_PROVIDER_MAP));
}
