const SIMPLE_ICONS_BASE = 'https://cdn.simpleicons.org';
const JSDELIVR_SIMPLE_ICONS_BASE = 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons';

// Inline SVG data URIs for brands not available in simple-icons
const LINKEDIN_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%230A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.064 2.064 0 1 1 0-4.128 2.064 2.064 0 0 1 0 4.128zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>')}`;
const FAL_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%237C3AED"><rect width="24" height="24" rx="4"/><text x="12" y="17" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="white">fal</text></svg>')}`;

const BRAND_ALIASES = {
  x: 'twitter',
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
};

const BRAND_LOGOS = {
  google: `${SIMPLE_ICONS_BASE}/google/4285F4`,
  github: `${SIMPLE_ICONS_BASE}/github/FFFFFF`,
  facebook: `${SIMPLE_ICONS_BASE}/facebook/1877F2`,
  instagram: `${SIMPLE_ICONS_BASE}/instagram/E4405F`,
  tiktok: `${SIMPLE_ICONS_BASE}/tiktok/FFFFFF`,
  twitter: `${SIMPLE_ICONS_BASE}/x/FFFFFF`,
  reddit: `${SIMPLE_ICONS_BASE}/reddit/FF4500`,
  linkedin: LINKEDIN_SVG,
  slack: `${SIMPLE_ICONS_BASE}/slack/4A154B`,
  discord: `${SIMPLE_ICONS_BASE}/discord/5865F2`,
  whatsapp: `${SIMPLE_ICONS_BASE}/whatsapp/25D366`,
  gitlab: `${SIMPLE_ICONS_BASE}/gitlab/FC6D26`,
  bitbucket: `${SIMPLE_ICONS_BASE}/bitbucket/0052CC`,
  azuredevops: `${SIMPLE_ICONS_BASE}/azuredevops/0078D4`,
  notion: `${SIMPLE_ICONS_BASE}/notion/FFFFFF`,
  stripe: `${SIMPLE_ICONS_BASE}/stripe/635BFF`,
  paypal: `${SIMPLE_ICONS_BASE}/paypal/003087`,
  shopify: `${SIMPLE_ICONS_BASE}/shopify/96BF48`,
  aws: `${SIMPLE_ICONS_BASE}/amazonaws/FF9900`,
  azure: `${SIMPLE_ICONS_BASE}/microsoftazure/0078D4`,
  gcp: `${SIMPLE_ICONS_BASE}/googlecloud/4285F4`,
  telegram: `${SIMPLE_ICONS_BASE}/telegram/26A5E4`,
  jira: `${SIMPLE_ICONS_BASE}/jira/0052CC`,
  trello: `${SIMPLE_ICONS_BASE}/trello/0052CC`,
  airtable: `${SIMPLE_ICONS_BASE}/airtable/18BFFF`,
  confluence: `${SIMPLE_ICONS_BASE}/confluence/172B4D`,
  asana: `${SIMPLE_ICONS_BASE}/asana/F06A6A`,
  linear: `${SIMPLE_ICONS_BASE}/linear/5E6AD2`,
  box: `${SIMPLE_ICONS_BASE}/box/0061D5`,
  figma: `${SIMPLE_ICONS_BASE}/figma/F24E1E`,
  canva: `${SIMPLE_ICONS_BASE}/canva/00C4CC`,
  zendesk: `${SIMPLE_ICONS_BASE}/zendesk/03363D`,
  intercom: `${SIMPLE_ICONS_BASE}/intercom/1F8FED`,
  clickup: `${SIMPLE_ICONS_BASE}/clickup/7B68EE`,
  monday: `${SIMPLE_ICONS_BASE}/mondaydotcom/FF3D57`,
  microsoft365: `${SIMPLE_ICONS_BASE}/microsoft365/D83B01`,
  dropbox: `${SIMPLE_ICONS_BASE}/dropbox/0061FF`,
  zoom: `${SIMPLE_ICONS_BASE}/zoom/0B5CFF`,
  hubspot: `${SIMPLE_ICONS_BASE}/hubspot/FF7A59`,
  salesforce: `${SIMPLE_ICONS_BASE}/salesforce/00A1E0`,
  email: `${SIMPLE_ICONS_BASE}/gmail/EA4335`,
  fal: FAL_SVG,
};

const BRAND_LOGO_FALLBACKS = {
  google: `${JSDELIVR_SIMPLE_ICONS_BASE}/google.svg`,
  github: `${JSDELIVR_SIMPLE_ICONS_BASE}/github.svg`,
  facebook: `${JSDELIVR_SIMPLE_ICONS_BASE}/facebook.svg`,
  instagram: `${JSDELIVR_SIMPLE_ICONS_BASE}/instagram.svg`,
  tiktok: `${JSDELIVR_SIMPLE_ICONS_BASE}/tiktok.svg`,
  twitter: `${JSDELIVR_SIMPLE_ICONS_BASE}/x.svg`,
  reddit: `${JSDELIVR_SIMPLE_ICONS_BASE}/reddit.svg`,
  linkedin: LINKEDIN_SVG,
  slack: `${JSDELIVR_SIMPLE_ICONS_BASE}/slack.svg`,
  discord: `${JSDELIVR_SIMPLE_ICONS_BASE}/discord.svg`,
  whatsapp: `${JSDELIVR_SIMPLE_ICONS_BASE}/whatsapp.svg`,
  gitlab: `${JSDELIVR_SIMPLE_ICONS_BASE}/gitlab.svg`,
  bitbucket: `${JSDELIVR_SIMPLE_ICONS_BASE}/bitbucket.svg`,
  azuredevops: `${JSDELIVR_SIMPLE_ICONS_BASE}/azuredevops.svg`,
  notion: `${JSDELIVR_SIMPLE_ICONS_BASE}/notion.svg`,
  microsoft365: `${JSDELIVR_SIMPLE_ICONS_BASE}/microsoft365.svg`,
  dropbox: `${JSDELIVR_SIMPLE_ICONS_BASE}/dropbox.svg`,
  zoom: `${JSDELIVR_SIMPLE_ICONS_BASE}/zoom.svg`,
  hubspot: `${JSDELIVR_SIMPLE_ICONS_BASE}/hubspot.svg`,
  salesforce: `${JSDELIVR_SIMPLE_ICONS_BASE}/salesforce.svg`,
  confluence: `${JSDELIVR_SIMPLE_ICONS_BASE}/confluence.svg`,
  asana: `${JSDELIVR_SIMPLE_ICONS_BASE}/asana.svg`,
  linear: `${JSDELIVR_SIMPLE_ICONS_BASE}/linear.svg`,
  box: `${JSDELIVR_SIMPLE_ICONS_BASE}/box.svg`,
  airtable: `${JSDELIVR_SIMPLE_ICONS_BASE}/airtable.svg`,
  figma: `${JSDELIVR_SIMPLE_ICONS_BASE}/figma.svg`,
  canva: `${JSDELIVR_SIMPLE_ICONS_BASE}/canva.svg`,
  zendesk: `${JSDELIVR_SIMPLE_ICONS_BASE}/zendesk.svg`,
  intercom: `${JSDELIVR_SIMPLE_ICONS_BASE}/intercom.svg`,
  clickup: `${JSDELIVR_SIMPLE_ICONS_BASE}/clickup.svg`,
  monday: `${JSDELIVR_SIMPLE_ICONS_BASE}/mondaydotcom.svg`,
  fal: FAL_SVG,
};

const SERVICE_ENV_REQUIREMENTS = {
  google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
  github: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI'],
  facebook: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET', 'FACEBOOK_REDIRECT_URI'],
  instagram: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET', 'INSTAGRAM_REDIRECT_URI'],
  tiktok: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'],
  twitter: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_REDIRECT_URI'],
  reddit: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_REDIRECT_URI'],
  linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI'],
  slack: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_REDIRECT_URI'],
  discord: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI'],
  whatsapp: ['WHATSAPP_BUSINESS_ACCOUNT_ID', 'WHATSAPP_API_TOKEN', 'WHATSAPP_WEBHOOK_TOKEN'],
  microsoft365: ['MICROSOFT365_CLIENT_ID', 'MICROSOFT365_CLIENT_SECRET', 'MICROSOFT365_REDIRECT_URI'],
  dropbox: ['DROPBOX_CLIENT_ID', 'DROPBOX_CLIENT_SECRET', 'DROPBOX_REDIRECT_URI'],
  trello: ['TRELLO_CLIENT_ID', 'TRELLO_CLIENT_SECRET', 'TRELLO_REDIRECT_URI'],
  zoom: ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_REDIRECT_URI'],
  hubspot: ['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET', 'HUBSPOT_REDIRECT_URI'],
  salesforce: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET', 'SALESFORCE_REDIRECT_URI'],
  jira: ['JIRA_CLIENT_ID', 'JIRA_CLIENT_SECRET', 'JIRA_REDIRECT_URI'],
  confluence: ['CONFLUENCE_CLIENT_ID', 'CONFLUENCE_CLIENT_SECRET', 'CONFLUENCE_REDIRECT_URI'],
  asana: ['ASANA_CLIENT_ID', 'ASANA_CLIENT_SECRET', 'ASANA_REDIRECT_URI'],
  linear: ['LINEAR_CLIENT_ID', 'LINEAR_CLIENT_SECRET', 'LINEAR_REDIRECT_URI'],
  box: ['BOX_CLIENT_ID', 'BOX_CLIENT_SECRET', 'BOX_REDIRECT_URI'],
  airtable: ['AIRTABLE_CLIENT_ID', 'AIRTABLE_CLIENT_SECRET', 'AIRTABLE_REDIRECT_URI'],
  figma: ['FIGMA_CLIENT_ID', 'FIGMA_CLIENT_SECRET', 'FIGMA_REDIRECT_URI'],
  canva: ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CANVA_REDIRECT_URI'],
  zendesk: ['ZENDESK_SUBDOMAIN', 'ZENDESK_CLIENT_ID', 'ZENDESK_CLIENT_SECRET', 'ZENDESK_REDIRECT_URI'],
  intercom: ['INTERCOM_CLIENT_ID', 'INTERCOM_CLIENT_SECRET', 'INTERCOM_REDIRECT_URI'],
  clickup: ['CLICKUP_CLIENT_ID', 'CLICKUP_CLIENT_SECRET', 'CLICKUP_REDIRECT_URI'],
  monday: ['MONDAY_CLIENT_ID', 'MONDAY_CLIENT_SECRET', 'MONDAY_REDIRECT_URI'],
  email: ['EMAIL_PROVIDER', 'EMAIL_FROM', 'SMTP_HOST', 'SMTP_PORT'],
  fal: ['FAL_API_KEY (optional global fallback)'],
};

const AUTH_TYPE_STYLES = {
  oauth2: 'bg-indigo-500/15 text-indigo-300 border border-indigo-400/40',
  oauth: 'bg-indigo-500/15 text-indigo-300 border border-indigo-400/40',
  token: 'bg-sky-500/15 text-sky-300 border border-sky-400/40',
  key: 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/40',
  webhook: 'bg-purple-500/15 text-purple-300 border border-purple-400/40',
  smtp: 'bg-amber-500/15 text-amber-300 border border-amber-400/40',
  api_key: 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/40',
};

function canonicalBrandName(serviceName) {
  const normalized = String(serviceName || '').toLowerCase();
  return BRAND_ALIASES[normalized] || normalized;
}

export function getServiceLogo(service) {
  return service.icon || BRAND_LOGOS[canonicalBrandName(service.name)] || null;
}

export function getServiceLogoFallbacks(service) {
  const canonicalName = canonicalBrandName(service?.name);
  const urls = [
    BRAND_LOGOS[canonicalName],
    BRAND_LOGO_FALLBACKS[canonicalName],
  ].filter(Boolean);

  return Array.from(new Set(urls));
}

export function getServiceEnvRequirements(serviceName) {
  return SERVICE_ENV_REQUIREMENTS[serviceName] || [];
}

export function getAuthTypeStyle(authType) {
  return AUTH_TYPE_STYLES[authType] || 'bg-slate-500/15 text-slate-300 border border-slate-500/40';
}

function toDisplayLabel(value, fallback = null) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const KNOWN_STATUS = new Set(['connected', 'pending', 'error', 'disconnected']);

const OAUTH_SERVICES = new Set([
  'google', 'github', 'facebook', 'instagram', 'tiktok', 'twitter', 'reddit',
  'linkedin', 'slack', 'discord', 'whatsapp', 'notion', 'gitlab', 'bitbucket', 'telegram',
  'microsoft365', 'dropbox', 'trello', 'zoom', 'hubspot', 'salesforce', 'jira',
  'confluence', 'asana', 'linear', 'box', 'airtable', 'figma', 'canva',
  'zendesk', 'intercom', 'clickup', 'monday',
]);

const API_ROOT_FALLBACKS = {
  google: 'https://www.googleapis.com',
  github: 'https://api.github.com',
  facebook: 'https://graph.facebook.com',
  instagram: 'https://graph.instagram.com',
  tiktok: 'https://open.tiktokapis.com',
  twitter: 'https://api.twitter.com/2',
  reddit: 'https://oauth.reddit.com',
  linkedin: 'https://api.linkedin.com/v2',
  slack: 'https://slack.com/api',
  discord: 'https://discord.com/api/v10',
  notion: 'https://api.notion.com/v1',
  microsoft365: 'https://graph.microsoft.com',
  dropbox: 'https://api.dropboxapi.com/2',
  trello: 'https://api.trello.com/1',
  zoom: 'https://api.zoom.us/v2',
  hubspot: 'https://api.hubapi.com',
  salesforce: 'https://login.salesforce.com',
  jira: 'https://api.atlassian.com',
  confluence: 'https://api.atlassian.com',
  asana: 'https://app.asana.com/api/1.0',
  linear: 'https://api.linear.app',
  box: 'https://api.box.com/2.0',
  airtable: 'https://api.airtable.com/v0',
  figma: 'https://api.figma.com/v1',
  canva: 'https://api.canva.com/rest/v1',
  zendesk: 'https://developer.zendesk.com',
  intercom: 'https://api.intercom.io',
  clickup: 'https://api.clickup.com/api/v2',
  monday: 'https://api.monday.com/v2',
};

function normalizeStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return KNOWN_STATUS.has(normalized) ? normalized : 'disconnected';
}

function inferAuthType(serviceName, authType) {
  const normalized = typeof authType === 'string' ? authType.trim().toLowerCase() : '';
  if (normalized) return normalized;
  if (OAUTH_SERVICES.has(String(serviceName || '').toLowerCase())) return 'oauth2';
  return '';
}

export function formatAuthTypeLabel(authType, serviceName = '') {
  const normalized = inferAuthType(serviceName, authType);
  if (!normalized) return 'Auth Unspecified';

  const labels = {
    oauth2: 'OAuth 2.0',
    oauth: 'OAuth',
    api_key: 'API Key',
    apikey: 'API Key',
    key: 'API Key',
    bearer: 'Bearer Token',
    token: 'Access Token',
    webhook: 'Webhook',
    smtp: 'SMTP',
    sendgrid: 'SendGrid API Key',
  };

  return labels[normalized] || toDisplayLabel(normalized, 'Auth Unspecified');
}

export function formatCategoryLabel(category, categoryLabel) {
  return toDisplayLabel(categoryLabel || category, 'Uncategorized');
}

export function normalizeService(rawService, oauthMeta) {
  // Use id as the canonical identifier (e.g. 'microsoft365'), name is the display label (e.g. 'Microsoft 365')
  const serviceName = rawService.id || rawService.name || rawService.service || 'unknown';
  const label = rawService.label || rawService.name || toDisplayLabel(serviceName, serviceName);
  // Use oauthMeta.auth_type if available (from /api/v1/oauth/status), otherwise fall back to rawService
  const inferredAuthType = inferAuthType(serviceName, oauthMeta?.auth_type || rawService.auth_type || rawService.authType || null);
  const apiEndpoint = rawService.api_endpoint || rawService.apiEndpoint || API_ROOT_FALLBACKS[String(serviceName).toLowerCase()] || null;
  const documentationUrl = rawService.documentation_url || rawService.documentationUrl || null;
  const category = rawService.category_name || rawService.categoryName || rawService.category || null;
  const categoryLabel = formatCategoryLabel(category, rawService.category_label || rawService.categoryLabel);

  return {
    name: serviceName,
    label,
    icon: getServiceLogo({ ...rawService, name: serviceName }),
    logoFallbacks: getServiceLogoFallbacks({ ...rawService, name: serviceName }),
    description: rawService.description || `Connect to ${label}`,
    auth_type: inferredAuthType || null,
    auth_type_label: formatAuthTypeLabel(inferredAuthType, serviceName),
    api_endpoint: apiEndpoint,
    documentation_url: documentationUrl,
    category,
    category_label: categoryLabel,
    status: normalizeStatus(oauthMeta?.status),
    lastApiCall: oauthMeta?.lastApiCall || oauthMeta?.last_sync || null,
    enabled: oauthMeta?.enabled !== false,
    // Instagram/Dropbox should behave like other OAuth cards (show Connect), even if optional env vars are missing.
    notConfigured: oauthMeta?.enabled === false && !['instagram', 'dropbox'].includes(String(serviceName).toLowerCase()),
    env_requirements: getServiceEnvRequirements(serviceName),
  };
}

export function getStatusMeta(status, notConfigured = false) {
  if (notConfigured) {
    return {
      label: 'Needs Setup',
      className: 'bg-amber-500/15 text-amber-300 border border-amber-400/40',
      dot: 'bg-amber-400',
    };
  }

  const map = {
    connected: {
      label: 'Connected',
      className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40',
      dot: 'bg-emerald-400',
    },
    pending: {
      label: 'Pending',
      className: 'bg-yellow-500/15 text-yellow-300 border border-yellow-400/40',
      dot: 'bg-yellow-400',
    },
    error: {
      label: 'Error',
      className: 'bg-red-500/15 text-red-300 border border-red-400/40',
      dot: 'bg-red-400',
    },
    disconnected: {
      label: 'Disconnected',
      className: 'bg-slate-500/15 text-slate-300 border border-slate-500/40',
      dot: 'bg-slate-400',
    },
  };

  return map[status] || map.disconnected;
}
