const SIMPLE_ICONS_BASE = 'https://cdn.simpleicons.org';
const JSDELIVR_SIMPLE_ICONS_BASE = 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons';

// Inline SVG data URIs for brands not available in simple-icons
const LINKEDIN_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.064 2.064 0 1 1 0-4.128 2.064 2.064 0 0 1 0 4.128zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>')}`;
const FAL_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#7C3AED"><rect width="24" height="24" rx="4"/><text x="12" y="17" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="white">fal</text></svg>')}`;
// Microsoft 365: 4-color grid (official Microsoft brand colors — not in simple-icons)
const MICROSOFT365_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg>')}`;
// Monday.com: 3-dot logo (not in simple-icons)
const MONDAY_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="4" cy="12" r="3.5" fill="#FFCB00"/><circle cx="12" cy="12" r="3.5" fill="#FF3D57"/><circle cx="20" cy="12" r="3.5" fill="#FF7C00"/></svg>')}`;
// Canva is not in simple-icons — use a plain data URI so the CDN is never hit
const CANVA_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#7D2AE7"/><text x="12" y="17" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="white">C</text></svg>')}`;

// Brands removed from cdn.simpleicons.org (trademark policy) — Google's favicon
// service serves the real colored logos and is the primary source for these.
const faviconLogo = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const BRAND_ALIASES = {
  x: 'twitter',
  linkedin_pages: 'linkedin',
  googleanalytics: 'google',
  googleanalytics4: 'google',
  google_analytics: 'google',
  gmail: 'google',
  googledrive: 'google',
  googledocs: 'google',
  googlesheets: 'google',
  googleslides: 'google',
  googlecalendar: 'google',
  googlephotos: 'google',
  googlecontacts: 'google',
  googletasks: 'google',
  googlemeet: 'google',
  googlebigquery: 'google',
  googleads: 'google',
  google_maps: 'google',
  google_classroom: 'google',
  google_search_console: 'google',
  youtubedatapi: 'google',
  microsoft_teams: 'microsoftteams',
  onedrive: 'microsoftonedrive',
  one_drive: 'microsoftonedrive',
  outlook: 'microsoftoutlook',
  share_point: 'sharepoint',
  excel: 'microsoft365',
  dynamics365: 'microsoft365',
  digital_ocean: 'digitalocean',
  hugging_face: 'huggingface',
  stack_exchange: 'stackexchange',
  cal: 'caldotcom',
};

const BRAND_LOGOS = {
  homeassistant: `${SIMPLE_ICONS_BASE}/homeassistant/18BCF2`,
  google: `${SIMPLE_ICONS_BASE}/google/4285F4`,
  github: `${SIMPLE_ICONS_BASE}/github/FFFFFF`,
  facebook: `${SIMPLE_ICONS_BASE}/facebook/1877F2`,
  instagram: `${SIMPLE_ICONS_BASE}/instagram/E4405F`,
  tiktok: `${SIMPLE_ICONS_BASE}/tiktok/FFFFFF`,
  twitter: `${SIMPLE_ICONS_BASE}/x/FFFFFF`,
  reddit: `${SIMPLE_ICONS_BASE}/reddit/FF4500`,
  linkedin: LINKEDIN_SVG,
  slack: faviconLogo('slack.com'),
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
  canva: CANVA_SVG,
  zendesk: `${SIMPLE_ICONS_BASE}/zendesk/03363D`,
  intercom: `${SIMPLE_ICONS_BASE}/intercom/1F8FED`,
  clickup: `${SIMPLE_ICONS_BASE}/clickup/7B68EE`,
  monday: MONDAY_SVG,
  microsoft365: MICROSOFT365_SVG,
  dropbox: `${SIMPLE_ICONS_BASE}/dropbox/0061FF`,
  zoom: `${SIMPLE_ICONS_BASE}/zoom/0B5CFF`,
  hubspot: `${SIMPLE_ICONS_BASE}/hubspot/FF7A59`,
  salesforce: faviconLogo('salesforce.com'),
  email: `${SIMPLE_ICONS_BASE}/gmail/EA4335`,
  fal: FAL_SVG,
  microsoftteams: faviconLogo('teams.microsoft.com'),
  microsoftonedrive: faviconLogo('onedrive.live.com'),
  microsoftoutlook: faviconLogo('outlook.com'),
  vercel: `${SIMPLE_ICONS_BASE}/vercel/FFFFFF`,
  supabase: `${SIMPLE_ICONS_BASE}/supabase/3FCF8E`,
  mailchimp: `${SIMPLE_ICONS_BASE}/mailchimp/FFE01B`,
  youtube: `${SIMPLE_ICONS_BASE}/youtube/FF0000`,
  // Composio-backed toolkit brands (fallbacks — primary logo comes from
  // logos.composio.dev via the backend `icon` field)
  sentry: `${SIMPLE_ICONS_BASE}/sentry/362D59`,
  pagerduty: `${SIMPLE_ICONS_BASE}/pagerduty/06AC38`,
  todoist: `${SIMPLE_ICONS_BASE}/todoist/E44332`,
  miro: `${SIMPLE_ICONS_BASE}/miro/050038`,
  calendly: `${SIMPLE_ICONS_BASE}/calendly/006BFF`,
  caldotcom: `${SIMPLE_ICONS_BASE}/caldotcom/292929`,
  square: `${SIMPLE_ICONS_BASE}/square/3E4348`,
  eventbrite: `${SIMPLE_ICONS_BASE}/eventbrite/F05537`,
  typeform: `${SIMPLE_ICONS_BASE}/typeform/262627`,
  strava: `${SIMPLE_ICONS_BASE}/strava/FC4C02`,
  webex: `${SIMPLE_ICONS_BASE}/webex/000000`,
  contentful: `${SIMPLE_ICONS_BASE}/contentful/2478CC`,
  digitalocean: `${SIMPLE_ICONS_BASE}/digitalocean/0080FF`,
  huggingface: `${SIMPLE_ICONS_BASE}/huggingface/FFD21E`,
  stackexchange: `${SIMPLE_ICONS_BASE}/stackexchange/1E5397`,
  prisma: `${SIMPLE_ICONS_BASE}/prisma/2D3748`,
  basecamp: `${SIMPLE_ICONS_BASE}/basecamp/1D2D35`,
  wrike: `${SIMPLE_ICONS_BASE}/wrike/08CF65`,
  harvest: `${SIMPLE_ICONS_BASE}/harvest/F36C00`,
  freshbooks: `${SIMPLE_ICONS_BASE}/freshbooks/0075DD`,
  ticktick: `${SIMPLE_ICONS_BASE}/ticktick/4772FA`,
  quickbooks: `${SIMPLE_ICONS_BASE}/quickbooks/2CA01C`,
  sharepoint: faviconLogo('sharepoint.com'),
  attio: faviconLogo('attio.com'),
  productboard: faviconLogo('productboard.com'),
};

const BRAND_LOGO_FALLBACKS = {
  homeassistant: `${JSDELIVR_SIMPLE_ICONS_BASE}/homeassistant.svg`,
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
  microsoft365: MICROSOFT365_SVG,
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
  canva: CANVA_SVG,
  zendesk: `${JSDELIVR_SIMPLE_ICONS_BASE}/zendesk.svg`,
  intercom: `${JSDELIVR_SIMPLE_ICONS_BASE}/intercom.svg`,
  clickup: `${JSDELIVR_SIMPLE_ICONS_BASE}/clickup.svg`,
  monday: MONDAY_SVG,
  fal: FAL_SVG,
  microsoftteams: `${JSDELIVR_SIMPLE_ICONS_BASE}/microsoftteams.svg`,
  microsoftonedrive: `${JSDELIVR_SIMPLE_ICONS_BASE}/microsoftonedrive.svg`,
  microsoftoutlook: `${JSDELIVR_SIMPLE_ICONS_BASE}/microsoftoutlook.svg`,
  vercel: `${JSDELIVR_SIMPLE_ICONS_BASE}/vercel.svg`,
  supabase: `${JSDELIVR_SIMPLE_ICONS_BASE}/supabase.svg`,
  mailchimp: `${JSDELIVR_SIMPLE_ICONS_BASE}/mailchimp.svg`,
  youtube: `${JSDELIVR_SIMPLE_ICONS_BASE}/youtube.svg`,
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
  linkedin_pages: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_PAGES_REDIRECT_URI (or LINKEDIN_REDIRECT_URI)'],
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
  let normalized = String(serviceName || '').toLowerCase();
  if (normalized.startsWith('composio__')) {
    normalized = normalized.slice('composio__'.length);
  }
  return BRAND_ALIASES[normalized] || normalized;
}

export function getServiceLogo(service) {
  return service.icon || BRAND_LOGOS[canonicalBrandName(service.name)] || null;
}

export function getServiceLogoFallbacks(service) {
  const canonicalName = canonicalBrandName(service?.name);
  // simpleicons CDN first (has color), jsdelivr as fallback (monochrome)
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
  'linkedin', 'linkedin_pages', 'slack', 'discord', 'whatsapp', 'notion', 'gitlab', 'bitbucket', 'telegram',
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
  linkedin_pages: 'https://api.linkedin.com',
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
    byComposio: !!rawService.byComposio,
    source: rawService.source || null,
    connectToolkit: rawService.connectToolkit || null,
    toolkitSlug: rawService.toolkitSlug || null,
    // API-key (or no-auth) Composio toolkits carry their credential field spec so
    // the connect form can render the right inputs (OpenAI key, Replicate token...).
    authMode: rawService.authMode || (inferredAuthType === 'api_key' ? 'api_key' : null),
    authFields: Array.isArray(rawService.authFields) ? rawService.authFields : [],
    loginOnly: !!oauthMeta?.loginOnly,
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
