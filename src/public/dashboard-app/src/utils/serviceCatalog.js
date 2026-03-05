const SIMPLE_ICONS_BASE = 'https://cdn.simpleicons.org';

const BRAND_LOGOS = {
  google: `${SIMPLE_ICONS_BASE}/google/4285F4`,
  github: `${SIMPLE_ICONS_BASE}/github/FFFFFF`,
  facebook: `${SIMPLE_ICONS_BASE}/facebook/1877F2`,
  instagram: `${SIMPLE_ICONS_BASE}/instagram/E4405F`,
  tiktok: `${SIMPLE_ICONS_BASE}/tiktok/FFFFFF`,
  twitter: `${SIMPLE_ICONS_BASE}/x/FFFFFF`,
  reddit: `${SIMPLE_ICONS_BASE}/reddit/FF4500`,
  linkedin: `${SIMPLE_ICONS_BASE}/linkedin/0A66C2`,
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
};

const AUTH_TYPE_STYLES = {
  oauth2: 'bg-indigo-500/15 text-indigo-300 border border-indigo-400/40',
  token: 'bg-sky-500/15 text-sky-300 border border-sky-400/40',
  key: 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/40',
  webhook: 'bg-purple-500/15 text-purple-300 border border-purple-400/40',
};

export function getServiceLogo(service) {
  return service.icon || BRAND_LOGOS[service.name] || null;
}

export function getServiceEnvRequirements(serviceName) {
  return SERVICE_ENV_REQUIREMENTS[serviceName] || [];
}

export function getAuthTypeStyle(authType) {
  return AUTH_TYPE_STYLES[authType] || 'bg-slate-500/15 text-slate-300 border border-slate-500/40';
}

export function normalizeService(rawService, oauthMeta) {
  const label = rawService.label || rawService.name;
  return {
    name: rawService.name,
    label,
    icon: getServiceLogo(rawService),
    description: rawService.description || `Connect to ${label}`,
    auth_type: rawService.auth_type,
    api_endpoint: rawService.api_endpoint,
    documentation_url: rawService.documentation_url,
    category: rawService.category_name || rawService.category,
    category_label: rawService.category_label || rawService.category_name || rawService.category,
    status: oauthMeta?.status || 'disconnected',
    enabled: oauthMeta?.enabled !== false,
    notConfigured: oauthMeta?.enabled === false,
    env_requirements: getServiceEnvRequirements(rawService.name),
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
