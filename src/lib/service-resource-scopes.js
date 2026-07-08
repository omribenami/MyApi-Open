'use strict';

/**
 * Service sub-scopes: resource-level restrictions inside a connected service.
 *
 * Provider OAuth scopes stop at read/write for the whole account. MyApi lets
 * the owner narrow an agent further — e.g. Monday: only boards [123, 456];
 * Slack: only channels [C0AB..]; GitHub: only repos [org/repo]. Restrictions
 * live in the token's allowed_resources JSON under `service_resources`:
 *
 *   {
 *     "service_resources": {
 *       "monday":  { "boards":   ["1234567890"] },
 *       "slack":   { "channels": ["C0123ABCD", "#general"] },
 *       "github":  { "repos":    ["acme/api"] }
 *     }
 *   }
 *
 * Enforcement happens at the service proxy: each proxied request is parsed for
 * the resource ids it touches. Semantics per restricted kind:
 *   - request references ids of that kind → every id must be in the allow-list;
 *   - request clearly operates on that kind but the id can't be determined
 *     (e.g. a Monday GraphQL `boards` query with no ids) → DENY (fail closed),
 *     with a hint to address specific resources explicitly;
 *   - request doesn't touch that kind at all → allowed.
 * Empty/missing lists mean "unrestricted", matching allowed_resources semantics.
 *
 * The registry below is DECLARATIVE — each service lists its restrictable
 * resource kinds with:
 *   pathPatterns  — regexes run against the provider API path; capture group 1 = id
 *   bodyFields    — dotted paths into the JSON body ('data.project', arrays walked)
 *   queryFields   — query-param names carrying the id
 *   gqlPatterns   — regexes run against a GraphQL body.query string (capture 1 = id list)
 *   targetsKind   — (ctx) => true when the request addresses this kind even though
 *                   no id was extracted → indeterminate → fail closed
 *   matchMode     — 'exact' (default) or 'prefix' (allowed value is a path prefix,
 *                   e.g. Dropbox folders)
 *   lister        — how to enumerate the user's resources for the dashboard picker
 *                   (executed through the service proxy machinery by index.js);
 *                   omitted → the picker offers manual ID entry only.
 */

function gqlOf(ctx) {
  const q = ctx.body && typeof ctx.body === 'object' ? ctx.body.query : null;
  return typeof q === 'string' ? q : '';
}

// Read a dotted path from an object; arrays fan out. Returns array of scalars.
function readPath(obj, dotted) {
  let current = [obj];
  for (const part of dotted.split('.')) {
    const next = [];
    for (const item of current) {
      if (item == null || typeof item !== 'object') continue;
      const v = item[part];
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) next.push(...v); else next.push(v);
    }
    current = next;
  }
  return current.filter((v) => typeof v === 'string' || typeof v === 'number').map(String);
}

const SERVICE_RESOURCE_REGISTRY = {
  // ── Project management ──────────────────────────────────────────────────────
  monday: {
    kinds: [{
      kind: 'boards', label: 'Boards',
      gqlPatterns: [
        /\bboards\s*\(\s*[^)]*?\bids\s*:\s*\[?([0-9,\s"']+)/g,
        /\bboard_ids?\s*:\s*\[?([0-9,\s"']+)/g,
      ],
      bodyFields: ['board_id'],
      targetsKind: (ctx) => /\bboards\b|\bboard_id\b|\bcreate_board\b/.test(gqlOf(ctx)),
      lister: {
        request: { path: 'https://api.monday.com/v2', method: 'POST', body: { query: 'query { boards (limit: 200, order_by: used_at) { id name workspace { name } } }' } },
        parse: (data) => (data?.data?.boards || []).map(b => ({
          id: String(b.id),
          name: b.workspace?.name ? `${b.name} (${b.workspace.name})` : b.name,
        })),
      },
    }],
  },
  trello: {
    kinds: [{
      kind: 'boards', label: 'Boards',
      pathPatterns: [/\/boards\/([a-zA-Z0-9]+)/],
      bodyFields: ['idBoard'],
      queryFields: ['idBoard'],
      lister: {
        request: { path: 'https://api.trello.com/1/members/me/boards', method: 'GET', query: { fields: 'name' } },
        parse: (data) => (Array.isArray(data) ? data : []).map(b => ({ id: String(b.id), name: b.name })),
      },
    }],
  },
  asana: {
    kinds: [{
      kind: 'projects', label: 'Projects',
      pathPatterns: [/\/projects\/(\d+)/],
      bodyFields: ['data.projects', 'data.project'],
      queryFields: ['project', 'projects'],
      lister: {
        request: { path: 'https://app.asana.com/api/1.0/projects', method: 'GET', query: { limit: '100' } },
        parse: (data) => (data?.data || []).map(p => ({ id: String(p.gid), name: p.name })),
      },
    }],
  },
  jira: {
    kinds: [{
      kind: 'projects', label: 'Projects',
      pathPatterns: [
        /\/rest\/api\/[0-9.]+\/project\/([A-Z][A-Z0-9_]+)/i,
        /\/issue\/([A-Z][A-Z0-9_]+)-\d+/i,           // issue key carries its project prefix
      ],
      bodyFields: ['fields.project.key', 'fields.project.id'],
      lister: {
        request: { path: '/rest/api/3/project/search', method: 'GET', query: { maxResults: '100' } },
        parse: (data) => (data?.values || []).map(p => ({ id: String(p.key), name: `${p.name} (${p.key})` })),
      },
    }],
  },
  linear: {
    kinds: [{
      kind: 'teams', label: 'Teams',
      gqlPatterns: [/\bteamId\s*:\s*"([a-f0-9-]{20,})"/g, /\bteam\s*\(\s*id\s*:\s*"([a-f0-9-]{20,})"/g],
      lister: {
        request: { path: 'https://api.linear.app/graphql', method: 'POST', body: { query: 'query { teams { nodes { id name } } }' } },
        parse: (data) => (data?.data?.teams?.nodes || []).map(t => ({ id: String(t.id), name: t.name })),
      },
    }],
  },
  clickup: {
    kinds: [
      { kind: 'spaces', label: 'Spaces', pathPatterns: [/\/space\/(\d+)/], bodyFields: ['space_id'] },
      { kind: 'lists', label: 'Lists', pathPatterns: [/\/list\/(\d+)/], bodyFields: ['list_id'] },
    ],
  },
  todoist: {
    kinds: [{
      kind: 'projects', label: 'Projects',
      pathPatterns: [/\/projects\/([A-Za-z0-9]+)/],
      bodyFields: ['project_id'],
      queryFields: ['project_id'],
      lister: {
        request: { path: 'https://api.todoist.com/api/v1/projects', method: 'GET' },
        parse: (data) => (data?.results || (Array.isArray(data) ? data : [])).map(p => ({ id: String(p.id), name: p.name })),
      },
    }],
  },
  basecamp: {
    kinds: [{
      kind: 'projects', label: 'Projects',
      pathPatterns: [/\/projects\/(\d+)/, /\/buckets\/(\d+)/],
      lister: {
        request: { path: '/projects.json', method: 'GET' },
        parse: (data) => (Array.isArray(data) ? data : []).map(p => ({ id: String(p.id), name: p.name })),
      },
    }],
  },
  wrike: {
    kinds: [{
      kind: 'folders', label: 'Folders / Projects',
      pathPatterns: [/\/folders\/([A-Za-z0-9]+)/],
      lister: {
        request: { path: 'https://www.wrike.com/api/v4/folders', method: 'GET' },
        parse: (data) => (data?.data || []).map(f => ({ id: String(f.id), name: f.title })),
      },
    }],
  },
  miro: {
    kinds: [{
      kind: 'boards', label: 'Boards',
      pathPatterns: [/\/v2\/boards\/([A-Za-z0-9_=-]+)/],
      bodyFields: ['board_id', 'boardId'],
      lister: {
        request: { path: 'https://api.miro.com/v2/boards', method: 'GET', query: { limit: '50' } },
        parse: (data) => (data?.data || []).map(b => ({ id: String(b.id), name: b.name })),
      },
    }],
  },

  // ── Chat / messaging ────────────────────────────────────────────────────────
  slack: {
    kinds: [{
      kind: 'channels', label: 'Channels',
      bodyFields: ['channel', 'channel_id'],
      queryFields: ['channel', 'channel_id'],
      // Channel-addressed API family with no channel specified fails closed;
      // conversations.list/open are discovery, not access.
      targetsKind: (ctx) =>
        /\/(chat|conversations|pins|reactions|files)\./.test('/' + String(ctx.apiPath || '').replace(/^\//, '')) &&
        !/conversations\.(list|open)/.test(String(ctx.apiPath || '')),
      lister: {
        request: { path: 'https://slack.com/api/conversations.list', method: 'GET', query: { types: 'public_channel,private_channel', limit: '200', exclude_archived: 'true' } },
        parse: (data) => (data?.channels || []).map(c => ({ id: String(c.id), name: `#${c.name}` })),
      },
    }],
  },
  discord: {
    kinds: [
      {
        kind: 'guilds', label: 'Servers',
        pathPatterns: [/\/guilds\/(\d+)/],
        bodyFields: ['guild_id', 'server_id'],
        lister: {
          request: { path: 'https://discord.com/api/v10/users/@me/guilds', method: 'GET' },
          parse: (data) => (Array.isArray(data) ? data : []).map(g => ({ id: String(g.id), name: g.name })),
        },
      },
      {
        kind: 'channels', label: 'Channels',
        pathPatterns: [/\/channels\/(\d+)/],
        bodyFields: ['channel_id'],
        lister: {
          requiresParent: 'guild',
          request: (parent) => ({ path: `https://discord.com/api/v10/guilds/${parent}/channels`, method: 'GET' }),
          parse: (data) => (Array.isArray(data) ? data : [])
            .filter(c => c.type === 0 || c.type === 5)
            .map(c => ({ id: String(c.id), name: `#${c.name}` })),
        },
      },
    ],
  },
  telegram: {
    kinds: [{
      kind: 'chats', label: 'Chats',
      bodyFields: ['chat_id'],
      queryFields: ['chat_id'],
      targetsKind: (ctx) => /\/(send|forward|copy|pin|unpin|ban|edit|delete)[A-Za-z]*/.test(String(ctx.apiPath || '')),
    }],
  },
  whatsapp: {
    kinds: [{
      kind: 'recipients', label: 'Recipients',
      bodyFields: ['to'],
      targetsKind: (ctx) => /\/messages/.test(String(ctx.apiPath || '')),
    }],
  },
  microsoft_teams: {
    kinds: [
      {
        kind: 'teams', label: 'Teams',
        pathPatterns: [/\/teams\/([a-f0-9-]{20,})/i],
        lister: {
          request: { path: 'https://graph.microsoft.com/v1.0/me/joinedTeams', method: 'GET' },
          parse: (data) => (data?.value || []).map(t => ({ id: String(t.id), name: t.displayName })),
        },
      },
      {
        kind: 'channels', label: 'Channels',
        pathPatterns: [/\/channels\/([A-Za-z0-9%:@._-]+)/],
        lister: {
          requiresParent: 'team',
          request: (parent) => ({ path: `https://graph.microsoft.com/v1.0/teams/${parent}/channels`, method: 'GET' }),
          parse: (data) => (data?.value || []).map(c => ({ id: String(c.id), name: c.displayName })),
        },
      },
    ],
  },

  // ── Code hosting ────────────────────────────────────────────────────────────
  github: {
    kinds: [{
      kind: 'repos', label: 'Repositories',
      pathPatterns: [/\/repos\/([^/]+\/[^/?#]+)/],
      lister: {
        request: { path: 'https://api.github.com/user/repos', method: 'GET', query: { per_page: '100', sort: 'updated' } },
        parse: (data) => (Array.isArray(data) ? data : []).map(r => ({ id: String(r.full_name), name: r.full_name })),
      },
    }],
  },
  gitlab: {
    kinds: [{
      kind: 'projects', label: 'Projects',
      pathPatterns: [/\/projects\/([0-9]+|[^/?#]+%2F[^/?#]+)/],
      lister: {
        request: { path: 'https://gitlab.com/api/v4/projects', method: 'GET', query: { membership: 'true', per_page: '100', order_by: 'last_activity_at' } },
        parse: (data) => (Array.isArray(data) ? data : []).map(p => ({ id: String(p.id), name: p.path_with_namespace })),
      },
    }],
  },
  bitbucket: {
    kinds: [{
      kind: 'repos', label: 'Repositories',
      pathPatterns: [/\/repositories\/([^/]+\/[^/?#]+)/],
      lister: {
        request: { path: 'https://api.bitbucket.org/2.0/repositories', method: 'GET', query: { role: 'member', pagelen: '100' } },
        parse: (data) => (data?.values || []).map(r => ({ id: String(r.full_name), name: r.full_name })),
      },
    }],
  },

  // ── Docs / storage ──────────────────────────────────────────────────────────
  notion: {
    kinds: [
      {
        kind: 'databases', label: 'Databases',
        pathPatterns: [/\/databases\/([a-zA-Z0-9-]+)/],
        bodyFields: ['parent.database_id'],
        lister: {
          request: { path: 'https://api.notion.com/v1/search', method: 'POST', body: { filter: { property: 'object', value: 'database' }, page_size: 100 }, headers: { 'Notion-Version': '2022-06-28' } },
          parse: (data) => (data?.results || []).map(d => ({
            id: String(d.id),
            name: (d.title || []).map(t => t.plain_text).join('') || d.id,
          })),
        },
      },
      {
        kind: 'pages', label: 'Pages',
        pathPatterns: [/\/pages\/([a-zA-Z0-9-]+)/],
        bodyFields: ['parent.page_id'],
        lister: {
          request: { path: 'https://api.notion.com/v1/search', method: 'POST', body: { filter: { property: 'object', value: 'page' }, page_size: 100 }, headers: { 'Notion-Version': '2022-06-28' } },
          parse: (data) => (data?.results || []).map(p => ({
            id: String(p.id),
            name: Object.values(p.properties || {}).flatMap(prop => prop?.title || []).map(t => t.plain_text).join('') || p.id,
          })),
        },
      },
    ],
  },
  googledrive: {
    kinds: [{
      kind: 'files', label: 'Files / Folders',
      pathPatterns: [/\/files\/([a-zA-Z0-9_-]{10,})/],
      bodyFields: ['fileId', 'parents'],
      queryFields: ['fileId'],
      lister: {
        request: { path: 'https://www.googleapis.com/drive/v3/files', method: 'GET', query: { pageSize: '100', fields: 'files(id,name,mimeType)', orderBy: 'modifiedTime desc' } },
        parse: (data) => (data?.files || []).map(f => ({
          id: String(f.id),
          name: f.mimeType === 'application/vnd.google-apps.folder' ? `📁 ${f.name}` : f.name,
        })),
      },
    }],
  },
  googledocs: {
    kinds: [{
      kind: 'documents', label: 'Documents',
      pathPatterns: [/\/documents\/([a-zA-Z0-9_-]{10,})/],
      bodyFields: ['documentId'],
    }],
  },
  googlesheets: {
    kinds: [{
      kind: 'spreadsheets', label: 'Spreadsheets',
      pathPatterns: [/\/spreadsheets\/([a-zA-Z0-9_-]{10,})/],
      bodyFields: ['spreadsheetId'],
    }],
  },
  googleslides: {
    kinds: [{
      kind: 'presentations', label: 'Presentations',
      pathPatterns: [/\/presentations\/([a-zA-Z0-9_-]{10,})/],
      bodyFields: ['presentationId'],
    }],
  },
  googlecalendar: {
    kinds: [{
      kind: 'calendars', label: 'Calendars',
      pathPatterns: [/\/calendars\/([^/?#]+)/],
      bodyFields: ['calendarId'],
      queryFields: ['calendarId'],
      lister: {
        request: { path: 'https://www.googleapis.com/calendar/v3/users/me/calendarList', method: 'GET' },
        parse: (data) => (data?.items || []).map(c => ({ id: String(c.id), name: c.summary })),
      },
    }],
  },
  dropbox: {
    kinds: [{
      kind: 'folders', label: 'Folders',
      matchMode: 'prefix',
      bodyFields: ['path', 'from_path', 'to_path', 'path_display'],
      lister: {
        request: { path: 'https://api.dropboxapi.com/2/files/list_folder', method: 'POST', body: { path: '', recursive: false } },
        parse: (data) => (data?.entries || [])
          .filter(e => e['.tag'] === 'folder')
          .map(f => ({ id: String(f.path_lower || f.path_display), name: f.path_display })),
      },
    }],
  },
  box: {
    kinds: [{
      kind: 'folders', label: 'Folders',
      pathPatterns: [/\/folders\/(\d+)/],
      bodyFields: ['parent.id', 'folder_id'],
      lister: {
        request: { path: 'https://api.box.com/2.0/folders/0/items', method: 'GET', query: { limit: '100' } },
        parse: (data) => (data?.entries || []).filter(e => e.type === 'folder').map(f => ({ id: String(f.id), name: f.name })),
      },
    }],
  },
  confluence: {
    kinds: [{
      kind: 'spaces', label: 'Spaces',
      pathPatterns: [/\/space\/([A-Za-z0-9~_-]+)/, /\/spaces\/([A-Za-z0-9~_-]+)/],
      bodyFields: ['space.key', 'spaceId'],
      queryFields: ['spaceKey'],
      lister: {
        request: { path: '/wiki/rest/api/space', method: 'GET', query: { limit: '100' } },
        parse: (data) => (data?.results || []).map(s => ({ id: String(s.key), name: s.name })),
      },
    }],
  },
  figma: {
    kinds: [{
      kind: 'files', label: 'Files',
      pathPatterns: [/\/v1\/files\/([a-zA-Z0-9]+)/, /\/v1\/images\/([a-zA-Z0-9]+)/],
    }],
  },
  airtable: {
    kinds: [{
      kind: 'bases', label: 'Bases',
      pathPatterns: [/\/v0\/(app[a-zA-Z0-9]{14,17})/],
      lister: {
        request: { path: 'https://api.airtable.com/v0/meta/bases', method: 'GET' },
        parse: (data) => (data?.bases || []).map(b => ({ id: String(b.id), name: b.name })),
      },
    }],
  },

  // ── Social / marketing ──────────────────────────────────────────────────────
  reddit: {
    kinds: [{
      kind: 'subreddits', label: 'Subreddits',
      pathPatterns: [/\/r\/([A-Za-z0-9_]+)/],
      bodyFields: ['sr'],
      lister: {
        request: { path: 'https://oauth.reddit.com/subreddits/mine/subscriber', method: 'GET', query: { limit: '100' } },
        parse: (data) => (data?.data?.children || []).map(c => ({ id: String(c.data.display_name), name: `r/${c.data.display_name}` })),
      },
    }],
  },
  facebook: {
    kinds: [{
      kind: 'pages', label: 'Pages',
      bodyFields: ['page_id'],
      queryFields: ['page_id'],
      pathPatterns: [/^\/?(\d{10,})(?:\/|$)/],
      lister: {
        request: { path: 'https://graph.facebook.com/v19.0/me/accounts', method: 'GET' },
        parse: (data) => (data?.data || []).map(p => ({ id: String(p.id), name: p.name })),
      },
    }],
  },
  instagram: {
    kinds: [{
      kind: 'accounts', label: 'Accounts',
      bodyFields: ['account_id'],
      queryFields: ['account_id'],
    }],
  },
  linkedin_pages: {
    kinds: [{
      kind: 'organizations', label: 'Organizations',
      bodyFields: ['organization_id'],
      pathPatterns: [/urn(?:%3A|:)li(?:%3A|:)organization(?:%3A|:)(\d+)/],
      lister: {
        request: {
          path: '/rest/organizationAcls', method: 'GET',
          query: { q: 'roleAssignee', role: 'ADMINISTRATOR', state: 'APPROVED' },
          headers: { 'LinkedIn-Version': '202506', 'X-Restli-Protocol-Version': '2.0.0' },
        },
        parse: (data) => (data?.elements || []).map(e => {
          const id = String(e.organization || '').split(':').pop();
          return { id, name: e['organization~']?.localizedName || `Organization ${id}` };
        }),
      },
    }],
  },
  google_analytics: {
    kinds: [{
      kind: 'properties', label: 'Properties',
      // GA4 Data/Admin APIs address properties in the path: /v1beta/properties/{id}:runReport
      pathPatterns: [/\/properties\/(\d+)/],
      lister: {
        request: { path: 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries', method: 'GET' },
        parse: (data) => (data?.accountSummaries || []).flatMap(a =>
          (a.propertySummaries || []).map(p => ({
            id: String(p.property || '').split('/').pop(),
            name: a.displayName ? `${p.displayName} (${a.displayName})` : p.displayName,
          }))
        ),
      },
    }],
  },
  mailchimp: {
    kinds: [{
      kind: 'audiences', label: 'Audiences (Lists)',
      pathPatterns: [/\/lists\/([a-z0-9]{8,})/],
      bodyFields: ['list_id'],
      lister: {
        request: { path: '/3.0/lists', method: 'GET', query: { count: '100' } },
        parse: (data) => (data?.lists || []).map(l => ({ id: String(l.id), name: l.name })),
      },
    }],
  },

  // ── Smart home ──────────────────────────────────────────────────────────────
  homeassistant: {
    kinds: [
      {
        kind: 'entities', label: 'Entities',
        // /states/{entity_id} reads + entity_id in service-call bodies
        // (flat, service_data, or target.entity_id — string or array).
        pathPatterns: [/\/states\/([a-z_]+\.[A-Za-z0-9_]+)/],
        bodyFields: ['entity_id', 'service_data.entity_id', 'target.entity_id'],
        // Fail closed under an entity restriction when: (a) a service call has
        // no entity target (it would act domain-wide), or (b) the agent asks
        // for the bulk /states list (it would read entities outside its scope —
        // restricted agents must read /states/{entity_id} individually).
        targetsKind: (ctx) => {
          const p = String(ctx.apiPath || '').replace(/^\//, '');
          if (/^states\/?($|\?)/.test(p)) return true;
          return /^services\/[a-z_]+\/[a-z_0-9]+/.test(p) && String(ctx.method || 'POST').toUpperCase() === 'POST';
        },
        lister: {
          request: { path: '/states', method: 'GET' },
          parse: (data) => (Array.isArray(data) ? data : []).map(s => ({
            id: String(s.entity_id),
            name: s.attributes?.friendly_name ? `${s.attributes.friendly_name} (${s.entity_id})` : s.entity_id,
          })),
        },
      },
      {
        kind: 'domains', label: 'Service Domains',
        // /services/{domain}/{service} — restrict which action families
        // (light, switch, climate, ...) the agent may call.
        pathPatterns: [/\/services\/([a-z_]+)\//],
        lister: {
          request: { path: '/services', method: 'GET' },
          parse: (data) => (Array.isArray(data) ? data : []).map(d => ({ id: String(d.domain), name: d.domain })),
        },
      },
    ],
  },

  // ── Infra / dev tools ───────────────────────────────────────────────────────
  cloudflare: {
    kinds: [{
      kind: 'zones', label: 'Zones (Domains)',
      pathPatterns: [/\/zones\/([a-f0-9]{32})/],
      queryFields: ['zone_id'],
      lister: {
        request: { path: 'https://api.cloudflare.com/client/v4/zones', method: 'GET', query: { per_page: '50' } },
        parse: (data) => (data?.result || []).map(z => ({ id: String(z.id), name: z.name })),
      },
    }],
  },
  vercel: {
    kinds: [{
      kind: 'projects', label: 'Projects',
      pathPatterns: [/\/projects\/([a-zA-Z0-9_-]+)/],
      queryFields: ['projectId'],
      bodyFields: ['projectId'],
      lister: {
        request: { path: 'https://api.vercel.com/v9/projects', method: 'GET', query: { limit: '100' } },
        parse: (data) => (data?.projects || []).map(p => ({ id: String(p.id), name: p.name })),
      },
    }],
  },
  supabase: {
    kinds: [{
      kind: 'projects', label: 'Projects',
      pathPatterns: [/\/v1\/projects\/([a-z0-9]+)/],
      lister: {
        request: { path: 'https://api.supabase.com/v1/projects', method: 'GET' },
        parse: (data) => (Array.isArray(data) ? data : []).map(p => ({ id: String(p.id), name: p.name })),
      },
    }],
  },
  sentry: {
    kinds: [{
      kind: 'projects', label: 'Projects',
      pathPatterns: [/\/projects\/[^/]+\/([^/?#]+)/],
      lister: {
        request: { path: 'https://sentry.io/api/0/projects/', method: 'GET' },
        parse: (data) => (Array.isArray(data) ? data : []).map(p => ({ id: String(p.slug), name: p.name })),
      },
    }],
  },
  zendesk: {
    kinds: [{
      kind: 'views', label: 'Views',
      pathPatterns: [/\/views\/(\d+)/],
      lister: {
        request: { path: '/api/v2/views', method: 'GET' },
        parse: (data) => (data?.views || []).map(v => ({ id: String(v.id), name: v.title })),
      },
    }],
  },
};

// Backwards-compatible view: { service: [{kind, label, lister}] }
const SERVICE_RESOURCE_KINDS = Object.fromEntries(
  Object.entries(SERVICE_RESOURCE_REGISTRY).map(([svc, cfg]) => [svc, cfg.kinds])
);

// Lightweight capability map for the dashboard: { service: [{kind, label, hasLister, requiresParent}] }
function getResourceCapabilities() {
  const out = {};
  for (const [svc, cfg] of Object.entries(SERVICE_RESOURCE_REGISTRY)) {
    out[svc] = cfg.kinds.map(k => ({
      kind: k.kind,
      label: k.label,
      hasLister: !!k.lister,
      requiresParent: k.lister?.requiresParent || undefined,
      matchMode: k.matchMode || 'exact',
    }));
  }
  return out;
}

/**
 * Extract the resource ids a proxied request touches.
 * ctx = { apiPath, method, body, query }
 * Returns { refs: [{kind, id}], indeterminate: Set<kind> }.
 */
function extractResourceRefs(service, ctx) {
  const refs = [];
  const indeterminate = new Set();
  const cfg = SERVICE_RESOURCE_REGISTRY[String(service).toLowerCase()];
  if (!cfg) return { refs, indeterminate };

  const apiPath = String(ctx.apiPath || '');
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  const query = ctx.query && typeof ctx.query === 'object' ? ctx.query : {};
  const gql = gqlOf(ctx);

  for (const spec of cfg.kinds) {
    const ids = [];

    for (const re of spec.pathPatterns || []) {
      const m = apiPath.match(re);
      if (m && m[1]) ids.push(decodeURIComponent(m[1]));
    }
    for (const field of spec.bodyFields || []) {
      ids.push(...readPath(body, field));
    }
    for (const field of spec.queryFields || []) {
      const v = query[field];
      if (v !== undefined && v !== null && v !== '') ids.push(String(v));
    }
    if (gql) {
      for (const re of spec.gqlPatterns || []) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(gql)) !== null) {
          // Capture may be a list ("123, 456") for numeric GraphQL id lists.
          const chunk = m[1];
          const numeric = String(chunk).match(/\d{5,}/g);
          if (numeric) ids.push(...numeric);
          else if (chunk) ids.push(String(chunk).replace(/["'\s]/g, ''));
        }
      }
    }

    if (ids.length > 0) {
      for (const id of ids) refs.push({ kind: spec.kind, id: String(id) });
    } else if (typeof spec.targetsKind === 'function' && spec.targetsKind(ctx)) {
      indeterminate.add(spec.kind);
    }
  }
  return { refs, indeterminate };
}

function normalizeId(id) {
  return String(id).toLowerCase().replace(/^#/, '').replace(/-/g, '');
}

// Prefix matching keeps '/' structure (Dropbox-style path prefixes).
function normalizePathId(id) {
  return String(id).toLowerCase().replace(/\/+$/, '');
}

function kindSpec(service, kind) {
  const cfg = SERVICE_RESOURCE_REGISTRY[String(service).toLowerCase()];
  return cfg?.kinds.find(k => k.kind === kind) || null;
}

/**
 * Enforce a token's per-service resource restrictions against one proxied request.
 * `restrictions` = allowed_resources.service_resources[service] (object of kind → [ids]).
 * Returns { allowed: true } or { allowed: false, kind, reason }.
 */
function enforceServiceResources(restrictions, service, ctx) {
  if (!restrictions || typeof restrictions !== 'object') return { allowed: true };
  const activeKinds = Object.entries(restrictions)
    .filter(([, list]) => Array.isArray(list) && list.length > 0);
  if (activeKinds.length === 0) return { allowed: true };

  const { refs, indeterminate } = extractResourceRefs(service, ctx);

  for (const [kind, list] of activeKinds) {
    const spec = kindSpec(service, kind);
    const prefixMode = spec?.matchMode === 'prefix';

    if (indeterminate.has(kind)) {
      return {
        allowed: false, kind,
        reason: `This token is restricted to specific ${kind} in '${service}'. The request does not identify which ${kind} it targets — address the allowed resources explicitly (allowed: ${list.join(', ')}).`,
      };
    }
    for (const ref of refs) {
      if (ref.kind !== kind) continue;
      let ok;
      if (prefixMode) {
        const refPath = normalizePathId(ref.id);
        ok = list.some((allowed) => {
          const prefix = normalizePathId(allowed);
          return refPath === prefix || refPath.startsWith(prefix + '/');
        });
      } else {
        const allowedSet = new Set(list.map(normalizeId));
        ok = allowedSet.has(normalizeId(ref.id));
      }
      if (!ok) {
        return {
          allowed: false, kind,
          reason: `Access to ${kind.replace(/s$/, '')} '${ref.id}' in '${service}' is not permitted by this token's resource restrictions.`,
        };
      }
    }
  }
  return { allowed: true };
}

// Validate + canonicalize a service_resources object from user input.
function normalizeServiceResources(input) {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('service_resources must be an object keyed by service name');
  }
  const out = {};
  for (const [service, kinds] of Object.entries(input)) {
    if (!/^[a-z0-9_-]+$/i.test(service)) throw new Error(`service_resources: invalid service name '${service}'`);
    if (!kinds || typeof kinds !== 'object' || Array.isArray(kinds)) {
      throw new Error(`service_resources.${service} must be an object of {kind: [ids]}`);
    }
    const svc = {};
    for (const [kind, list] of Object.entries(kinds)) {
      if (!Array.isArray(list)) throw new Error(`service_resources.${service}.${kind} must be an array of ids`);
      const ids = [...new Set(list.map(v => String(v).trim()).filter(Boolean))];
      if (ids.length > 0) svc[kind] = ids;
    }
    if (Object.keys(svc).length > 0) out[service.toLowerCase()] = svc;
  }
  return Object.keys(out).length > 0 ? out : null;
}

module.exports = {
  SERVICE_RESOURCE_KINDS,
  SERVICE_RESOURCE_REGISTRY,
  getResourceCapabilities,
  extractResourceRefs,
  enforceServiceResources,
  normalizeServiceResources,
};
