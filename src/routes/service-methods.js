// ============================================================================
// SERVICE METHODS DOCUMENTATION FOR MYAPI
// 
// This file defines all available methods for each integrated service.
// When a user connects a service, these methods become available via:
//   GET /api/v1/services/:serviceId/methods
//
// Requirements:
// - User must have connected the service via OAuth
// - Bearer token must have `services:read` or `services:{serviceId}:read` scope
// - Master tokens always have access to all service methods
// ============================================================================

const SERVICE_METHODS = {
  
  // ==================== GOOGLE / GMAIL ====================
  google: [
    {
      name: 'gmail.messages.list',
      description: 'List Gmail messages from inbox',
      method: 'GET',
      endpoint: '/services/google/gmail/messages',
      scope: 'services:read or services:google:read or master',
      parameters: {
        maxResults: { 
          type: 'number', 
          description: 'Max messages to return (default: 10, max: 100)', 
          optional: true 
        },
        pageToken: { 
          type: 'string', 
          description: 'Pagination token from previous response', 
          optional: true 
        },
        q: {
          type: 'string',
          description: 'Gmail search query (e.g., "from:user@example.com is:unread")',
          optional: true
        }
      },
      returns: 'messages array with id, subject, from, to, date, snippet, threadId, labels',
      rateLimit: '10 req/sec per service account',
      notes: 'Uses Gmail API v1. Supports full Gmail search syntax.'
    },
    {
      name: 'gmail.messages.get',
      description: 'Get full Gmail message by ID',
      method: 'GET',
      endpoint: '/services/google/gmail/messages/:messageId',
      scope: 'services:read or services:google:read or master',
      parameters: {
        messageId: { 
          type: 'string', 
          description: 'Message ID from messages.list response', 
          optional: false 
        }
      },
      returns: 'full message object with body, headers, attachments, labels, internalDate',
      rateLimit: '10 req/sec per service account',
      notes: 'Returns complete message including MIME-formatted body.'
    },
    {
      name: 'gmail.send',
      description: 'Send an email via Gmail (requires full scope)',
      method: 'POST',
      endpoint: '/services/google/gmail/send',
      scope: 'services:google:write or master',
      parameters: {
        to: { type: 'array', description: 'Recipient email addresses', optional: false },
        subject: { type: 'string', description: 'Email subject', optional: false },
        body: { type: 'string', description: 'Email body (plain text or HTML)', optional: false },
        cc: { type: 'array', description: 'Carbon copy recipients', optional: true },
        bcc: { type: 'array', description: 'Blind carbon copy recipients', optional: true }
      },
      returns: 'confirmation with messageId and threadId',
      rateLimit: '10 req/sec per service account',
      notes: 'Requires services:google:write scope. Does not support attachments in this version.'
    }
  ],
  
  // ==================== GITHUB ====================
  github: [
    {
      name: 'repos.list',
      description: 'List all accessible GitHub repositories',
      method: 'GET',
      endpoint: '/services/github/repos',
      scope: 'services:read or services:github:read or master',
      parameters: {
        perPage: { 
          type: 'number', 
          description: 'Results per page (default: 30, max: 100)', 
          optional: true 
        },
        page: { 
          type: 'number', 
          description: 'Page number for pagination', 
          optional: true 
        },
        sort: { 
          type: 'string', 
          description: 'Sort by: updated, stars, name (default: updated)', 
          optional: true 
        },
        direction: {
          type: 'string',
          description: 'Sort direction: asc, desc (default: desc)',
          optional: true
        }
      },
      returns: 'repositories array with name, url, description, language, stargazers_count, forks_count, open_issues',
      rateLimit: '60 req/hour (unauthenticated), 5000 req/hour (authenticated)',
      notes: 'Lists both personal and organization repositories.'
    },
    {
      name: 'repos.get',
      description: 'Get detailed information about a specific repository',
      method: 'GET',
      endpoint: '/services/github/repos/:owner/:repo',
      scope: 'services:read or services:github:read or master',
      parameters: {
        owner: { type: 'string', description: 'Repository owner username', optional: false },
        repo: { type: 'string', description: 'Repository name', optional: false }
      },
      returns: 'repository object with full metadata, topics, license, homepage, default_branch',
      rateLimit: '5000 req/hour',
      notes: 'Returns comprehensive repo metadata including permissions.'
    },
    {
      name: 'issues.list',
      description: 'List issues from a GitHub repository',
      method: 'GET',
      endpoint: '/services/github/repos/:owner/:repo/issues',
      scope: 'services:read or services:github:read or master',
      parameters: {
        owner: { type: 'string', description: 'Repository owner', optional: false },
        repo: { type: 'string', description: 'Repository name', optional: false },
        state: { 
          type: 'string', 
          description: 'Filter: open, closed, all (default: open)', 
          optional: true 
        },
        labels: { 
          type: 'string', 
          description: 'Filter by labels (comma-separated)', 
          optional: true 
        },
        milestone: {
          type: 'string',
          description: 'Filter by milestone',
          optional: true
        },
        assignee: {
          type: 'string',
          description: 'Filter by assignee username',
          optional: true
        }
      },
      returns: 'issues array with number, title, body, labels, assignee, created_at, updated_at, state',
      rateLimit: '5000 req/hour',
      notes: 'Does not include pull requests by default.'
    },
    {
      name: 'pull_requests.list',
      description: 'List pull requests from a GitHub repository',
      method: 'GET',
      endpoint: '/services/github/repos/:owner/:repo/pulls',
      scope: 'services:read or services:github:read or master',
      parameters: {
        owner: { type: 'string', description: 'Repository owner', optional: false },
        repo: { type: 'string', description: 'Repository name', optional: false },
        state: { 
          type: 'string', 
          description: 'Filter: open, closed, all (default: open)', 
          optional: true 
        },
        head: {
          type: 'string',
          description: 'Filter by head branch',
          optional: true
        },
        base: {
          type: 'string',
          description: 'Filter by base branch',
          optional: true
        }
      },
      returns: 'pull_requests array with number, title, head, base, draft, state, requested_reviewers, mergeable',
      rateLimit: '5000 req/hour',
      notes: 'Requires OAuth token with repo scope for private repos.'
    }
  ],
  
  // ==================== SLACK ====================
  slack: [
    {
      name: 'channels.list',
      description: 'List all Slack channels the app has access to',
      method: 'GET',
      endpoint: '/services/slack/channels',
      scope: 'services:read or services:slack:read or master',
      parameters: {
        exclude_archived: { 
          type: 'boolean', 
          description: 'Exclude archived channels (default: true)', 
          optional: true 
        },
        limit: { 
          type: 'number', 
          description: 'Max channels to return (default: 100)', 
          optional: true 
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
          optional: true
        }
      },
      returns: 'channels array with id, name, created, creator, is_archived, topic, purpose, num_members',
      rateLimit: '20 requests per minute',
      notes: 'The bot must be added to channels to see them.'
    },
    {
      name: 'conversations.history',
      description: 'Get message history from a Slack channel',
      method: 'GET',
      endpoint: '/services/slack/conversations/:channelId/history',
      scope: 'services:read or services:slack:read or master',
      parameters: {
        channelId: { type: 'string', description: 'Slack channel ID (starts with C)', optional: false },
        limit: { 
          type: 'number', 
          description: 'Max messages to return (default: 100)', 
          optional: true 
        },
        cursor: { 
          type: 'string', 
          description: 'Pagination cursor', 
          optional: true 
        },
        latest: {
          type: 'string',
          description: 'End of time range (timestamp)',
          optional: true
        },
        oldest: {
          type: 'string',
          description: 'Start of time range (timestamp)',
          optional: true
        }
      },
      returns: 'messages array with ts, user, text, thread_ts, reactions, reply_count, thread_ts_replied_to',
      rateLimit: '20 requests per minute',
      notes: 'Timestamps (ts) are Unix timestamps with millisecond precision as strings.'
    },
    {
      name: 'users.list',
      description: 'List all users in the Slack workspace',
      method: 'GET',
      endpoint: '/services/slack/users',
      scope: 'services:read or services:slack:read or master',
      parameters: {
        limit: { 
          type: 'number', 
          description: 'Max users to return (default: 100)', 
          optional: true 
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
          optional: true
        }
      },
      returns: 'users array with id, name, real_name, email, is_bot, profile (photo, title, phone, etc)',
      rateLimit: '20 requests per minute',
      notes: 'Includes both active and deactivated users. Filter via is_admin, is_owner fields.'
    }
  ],
  
  // ==================== DISCORD ====================
  discord: [
    {
      name: 'guilds.list',
      description: 'List all Discord servers (guilds) the bot belongs to',
      method: 'GET',
      endpoint: '/services/discord/guilds',
      scope: 'services:read or services:discord:read or master',
      parameters: {
        with_counts: { 
          type: 'boolean', 
          description: 'Include member/online counts', 
          optional: true 
        }
      },
      returns: 'guilds array with id, name, icon, owner_id, member_count, online_count, roles, channels',
      rateLimit: '10 requests per 10 seconds',
      notes: 'Bot must be a member of the guild. Use icon URL to build custom guild avatars.'
    },
    {
      name: 'channels.list',
      description: 'List channels in a Discord server',
      method: 'GET',
      endpoint: '/services/discord/guilds/:guildId/channels',
      scope: 'services:read or services:discord:read or master',
      parameters: {
        guildId: { type: 'string', description: 'Discord guild (server) ID', optional: false }
      },
      returns: 'channels array with id, name, type (text/voice/category), topic, nsfw, position, parent_id',
      rateLimit: '10 requests per 10 seconds',
      notes: 'type: 0=text, 2=voice, 4=category. parent_id indicates category.'
    },
    {
      name: 'messages.list',
      description: 'Get message history from a Discord channel',
      method: 'GET',
      endpoint: '/services/discord/channels/:channelId/messages',
      scope: 'services:read or services:discord:read or master',
      parameters: {
        channelId: { type: 'string', description: 'Discord channel ID', optional: false },
        limit: { 
          type: 'number', 
          description: 'Max messages (default: 50, max: 100)', 
          optional: true 
        },
        before: { 
          type: 'string', 
          description: 'Get messages before this message ID', 
          optional: true 
        },
        after: {
          type: 'string',
          description: 'Get messages after this message ID',
          optional: true
        }
      },
      returns: 'messages array with id, content, author (username, avatar), timestamp, attachments, reactions, embeds',
      rateLimit: '5 requests per 5 seconds',
      notes: 'Requires MESSAGE_HISTORY intent.'
    },
    {
      name: 'messages.send',
      description: 'Send a message to a Discord channel',
      method: 'POST',
      endpoint: '/services/discord/channels/:channelId/messages',
      scope: 'services:write or services:discord:write or master',
      parameters: {
        channelId: { type: 'string', description: 'Discord channel ID', optional: false },
        content: { type: 'string', description: 'Message text (max 2000 chars)', optional: false },
        embeds: { type: 'array', description: 'Rich embed objects', optional: true },
        message_reference: { type: 'object', description: 'Reply to a message: {message_id}', optional: true }
      },
      returns: 'created message object with id, content, author, timestamp',
      rateLimit: '5 requests per 5 seconds',
      notes: 'Bot must have Send Messages permission in the channel. Use via POST /api/v1/services/discord/proxy with {path: "/channels/{id}/messages", method: "POST", body: {content: "..."}}'
    }
  ],
  
  // ==================== NOTION ====================
  notion: [
    {
      name: 'databases.list',
      description: 'List all Notion databases accessible to the integration',
      method: 'GET',
      endpoint: '/services/notion/databases',
      scope: 'services:read or services:notion:read or master',
      parameters: {
        start_cursor: { 
          type: 'string', 
          description: 'Pagination cursor', 
          optional: true 
        }
      },
      returns: 'databases array with id, title, created_time, last_edited_time, icon, cover, object_url',
      rateLimit: '3 requests per second',
      notes: 'Only shows databases shared with the integration. Share databases via Notion sharing menu.'
    },
    {
      name: 'databases.query',
      description: 'Query a Notion database with filters and sorting',
      method: 'POST',
      endpoint: '/services/notion/databases/:databaseId/query',
      scope: 'services:read or services:notion:read or master',
      parameters: {
        databaseId: { type: 'string', description: 'Notion database ID', optional: false },
        filter: { 
          type: 'object', 
          description: 'Filter object (supports and/or/property filters)', 
          optional: true 
        },
        sorts: { 
          type: 'array', 
          description: 'Sort configuration array (property + direction)', 
          optional: true 
        },
        page_size: {
          type: 'number',
          description: 'Results per page (default: 100, max: 100)',
          optional: true
        },
        start_cursor: {
          type: 'string',
          description: 'Pagination cursor',
          optional: true
        }
      },
      returns: 'pages array with id, properties (filtered by database schema), created_time, last_edited_time',
      rateLimit: '3 requests per second',
      notes: 'Filter syntax: {"property":"Name","rich_text":{"contains":"text"}}. Supports all Notion property types.'
    },
    {
      name: 'pages.retrieve',
      description: 'Get a specific Notion page',
      method: 'GET',
      endpoint: '/services/notion/pages/:pageId',
      scope: 'services:read or services:notion:read or master',
      parameters: {
        pageId: { type: 'string', description: 'Notion page ID (32-char UUID)', optional: false }
      },
      returns: 'page object with id, parent, properties (full schema), created_by, last_edited_by, archived',
      rateLimit: '3 requests per second',
      notes: 'Returns full page properties. Use databases.query for bulk retrieval.'
    }
  ],
  
  // ==================== MICROSOFT 365 ====================
  microsoft365: [
    {
      name: 'mail.folders.list',
      description: 'List email folders in Microsoft 365 Outlook',
      method: 'GET',
      endpoint: '/services/microsoft365/mail/folders',
      scope: 'services:read or services:microsoft365:read or master',
      parameters: {
        top: { 
          type: 'number', 
          description: 'Max folders to return (default: 10, max: 1000)', 
          optional: true 
        },
        skip: { 
          type: 'number', 
          description: 'Skip N folders for pagination', 
          optional: true 
        }
      },
      returns: 'folders array with id, displayName, parentFolderId, unreadItemCount, totalItemCount, childFolderCount',
      rateLimit: '2000 requests per 10 minutes',
      notes: 'Includes built-in folders (Inbox, Drafts, Sent Items, Deleted Items).'
    },
    {
      name: 'mail.messages.list',
      description: 'List emails from a Microsoft 365 mailbox',
      method: 'GET',
      endpoint: '/services/microsoft365/mail/messages',
      scope: 'services:read or services:microsoft365:read or master',
      parameters: {
        top: { 
          type: 'number', 
          description: 'Max messages (default: 10, max: 1000)', 
          optional: true 
        },
        skip: { 
          type: 'number', 
          description: 'Skip N messages for pagination', 
          optional: true 
        },
        filter: { 
          type: 'string', 
          description: 'OData filter (e.g., "isRead eq false")', 
          optional: true 
        }
      },
      returns: 'messages array with id, subject, from, toRecipients, receivedDateTime, importance, isRead, hasAttachments',
      rateLimit: '2000 requests per 10 minutes',
      notes: 'Default folder is Inbox. Use /folders endpoint to list folder IDs for filtering.'
    },
    {
      name: 'calendar.events.list',
      description: 'List calendar events from Microsoft 365',
      method: 'GET',
      endpoint: '/services/microsoft365/calendar/events',
      scope: 'services:read or services:microsoft365:read or master',
      parameters: {
        top: { 
          type: 'number', 
          description: 'Max events (default: 10, max: 1000)', 
          optional: true 
        },
        startDateTime: { 
          type: 'string', 
          description: 'Start date (ISO 8601: 2026-04-14T00:00:00Z)', 
          optional: true 
        },
        endDateTime: { 
          type: 'string', 
          description: 'End date (ISO 8601 format)', 
          optional: true 
        }
      },
      returns: 'events array with id, subject, start, end, organizer, attendees (email/name), location, bodyPreview, isReminderOn',
      rateLimit: '2000 requests per 10 minutes',
      notes: 'Times are in user timezone. Use start/endDateTime for range filtering.'
    },
    {
      name: 'contacts.list',
      description: 'List contacts from Microsoft 365',
      method: 'GET',
      endpoint: '/services/microsoft365/contacts',
      scope: 'services:read or services:microsoft365:read or master',
      parameters: {
        top: { 
          type: 'number', 
          description: 'Max contacts (default: 10, max: 1000)', 
          optional: true 
        },
        skip: {
          type: 'number',
          description: 'Skip N contacts for pagination',
          optional: true
        },
        filter: {
          type: 'string',
          description: 'OData filter (e.g., "givenName eq \'John\'")',
          optional: true
        }
      },
      returns: 'contacts array with id, displayName, givenName, surname, emailAddresses, phoneNumbers, jobTitle, companyName, officeLocation',
      rateLimit: '2000 requests per 10 minutes',
      notes: 'emailAddresses is array with address and type. Includes both personal and shared contacts.'
    }
  ],

  // ==================== HOME ASSISTANT ====================
  // Instance-hosted: all calls go through the generic proxy with the user's
  // stored instance URL + long-lived token. `path` below is the HA REST path
  // relative to {instance}/api.
  homeassistant: [
    {
      name: 'states.list',
      description: 'List every entity with its current state and attributes',
      method: 'POST',
      endpoint: '/services/homeassistant/proxy',
      scope: 'services:read or services:homeassistant:read or master',
      parameters: { path: { type: 'string', description: 'Use "/states"' }, method: { type: 'string', description: '"GET"' } },
      returns: 'array of {entity_id, state, attributes, last_changed, last_updated}',
      notes: 'Body: {"path": "/states", "method": "GET"}. Filter client-side by domain prefix (light., switch., sensor., climate., ...).'
    },
    {
      name: 'states.get',
      description: 'Get one entity state',
      method: 'POST',
      endpoint: '/services/homeassistant/proxy',
      scope: 'services:read or services:homeassistant:read or master',
      parameters: { path: { type: 'string', description: '"/states/{entity_id}" e.g. "/states/light.living_room"' }, method: { type: 'string', description: '"GET"' } },
      returns: '{entity_id, state, attributes, last_changed, last_updated}'
    },
    {
      name: 'services.call',
      description: 'Call a Home Assistant service — turn lights on/off, set climate, activate scenes, run automations/scripts',
      method: 'POST',
      endpoint: '/services/homeassistant/proxy',
      scope: 'services:write or services:homeassistant:write or master',
      parameters: {
        path: { type: 'string', description: '"/services/{domain}/{service}" e.g. "/services/light/turn_on"' },
        method: { type: 'string', description: '"POST"' },
        body: { type: 'object', description: 'Service data, e.g. {"entity_id": "light.living_room", "brightness_pct": 60}' }
      },
      returns: 'array of states that changed as a result of the call',
      notes: 'Body: {"path": "/services/light/turn_on", "method": "POST", "body": {"entity_id": "light.living_room"}}. List available services with GET "/services".'
    },
    {
      name: 'services.list',
      description: 'List every service domain and its services (what actions exist)',
      method: 'POST',
      endpoint: '/services/homeassistant/proxy',
      scope: 'services:read or services:homeassistant:read or master',
      parameters: { path: { type: 'string', description: '"/services"' }, method: { type: 'string', description: '"GET"' } },
      returns: 'array of {domain, services: {name: {description, fields}}}'
    },
    {
      name: 'history.period',
      description: 'State history for entities over a time period',
      method: 'POST',
      endpoint: '/services/homeassistant/proxy',
      scope: 'services:read or services:homeassistant:read or master',
      parameters: {
        path: { type: 'string', description: '"/history/period/{ISO timestamp}" (start time)' },
        method: { type: 'string', description: '"GET"' },
        query: { type: 'object', description: '{"filter_entity_id": "sensor.temperature", "end_time": "<ISO>"}' }
      },
      returns: 'array of state-change lists per entity'
    },
    {
      name: 'logbook.period',
      description: 'Logbook entries (human-readable event log)',
      method: 'POST',
      endpoint: '/services/homeassistant/proxy',
      scope: 'services:read or services:homeassistant:read or master',
      parameters: { path: { type: 'string', description: '"/logbook/{ISO timestamp}"' }, method: { type: 'string', description: '"GET"' }, query: { type: 'object', description: '{"entity": "light.living_room"}', optional: true } },
      returns: 'array of {when, name, message, entity_id}'
    },
    {
      name: 'template.render',
      description: 'Render a Jinja2 template against live instance state',
      method: 'POST',
      endpoint: '/services/homeassistant/proxy',
      scope: 'services:read or services:homeassistant:read or master',
      parameters: { path: { type: 'string', description: '"/template"' }, method: { type: 'string', description: '"POST"' }, body: { type: 'object', description: '{"template": "{{ states(\'sensor.temperature\') }}"}' } },
      returns: 'rendered template string'
    },
    {
      name: 'events.fire',
      description: 'Fire a custom event on the event bus',
      method: 'POST',
      endpoint: '/services/homeassistant/proxy',
      scope: 'services:write or services:homeassistant:write or master',
      parameters: { path: { type: 'string', description: '"/events/{event_type}"' }, method: { type: 'string', description: '"POST"' }, body: { type: 'object', description: 'event data payload', optional: true } },
      returns: '{message: "Event {event_type} fired."}'
    },
    {
      name: 'config.check',
      description: 'Instance config + API health',
      method: 'POST',
      endpoint: '/services/homeassistant/proxy',
      scope: 'services:read or services:homeassistant:read or master',
      parameters: { path: { type: 'string', description: '"/config" (or "/" for API health)' }, method: { type: 'string', description: '"GET"' } },
      returns: 'config object: location, version, components, unit system'
    }
  ]
};

module.exports = SERVICE_METHODS;
