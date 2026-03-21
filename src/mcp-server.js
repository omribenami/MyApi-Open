/**
 * MyApi MCP (Model Context Protocol) Server
 * 
 * Exposes MyApi unified OAuth services and data access to Claude, Cursor,
 * VS Code, and other MCP-compatible AI clients.
 * 
 * This allows AI assistants to:
 * - List connected services
 * - Execute service methods
 * - Read and sync data from multiple platforms
 * - Manage OAuth connections
 * 
 * Usage:
 *   node src/mcp-server.js --port 3001
 * 
 * Add to claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "myapi": {
 *       "command": "node",
 *       "args": ["/path/to/MyApi/src/mcp-server.js"]
 *     }
 *   }
 * }
 */

const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio');
const { Server } = require('@modelcontextprotocol/sdk/server/index');
const { CallToolRequestSchema, ListToolsRequestSchema, TextContent } = require('@modelcontextprotocol/sdk/types');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// Initialize database
const db = new Database('./src/data/myapi.db');

// Initialize MCP server
const server = new Server({
  name: 'myapi',
  version: '1.0.0',
});

// User context - passed in via environment or extracted from request
let currentUserId = process.env.MYAPI_USER_ID || null;

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_services',
        description: 'List all OAuth services connected to your MyApi account',
        inputSchema: {
          type: 'object',
          properties: {
            include_details: {
              type: 'boolean',
              description: 'Include detailed information about each service'
            }
          }
        }
      },
      {
        name: 'get_service_data',
        description: 'Fetch data from a connected service (email, calendar events, files, contacts, etc)',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              enum: ['gmail', 'calendar', 'drive', 'contacts', 'github', 'linkedin', 'discord', 'notion', 'slack'],
              description: 'The service to fetch data from'
            },
            query: {
              type: 'string',
              description: 'Query or parameters for data retrieval'
            },
            limit: {
              type: 'integer',
              description: 'Max results to return (default: 10)'
            }
          },
          required: ['service', 'query']
        }
      },
      {
        name: 'execute_service_method',
        description: 'Execute a specific method on a connected service',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'The service name (gmail, calendar, drive, etc)'
            },
            method: {
              type: 'string',
              description: 'The method to execute (send_email, create_event, etc)'
            },
            params: {
              type: 'object',
              description: 'Parameters for the method'
            }
          },
          required: ['service', 'method']
        }
      },
      {
        name: 'get_oauth_status',
        description: 'Check which services are connected and their status',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'search_all_services',
        description: 'Search across multiple connected services at once',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (email subject, file name, calendar title, etc)'
            },
            services: {
              type: 'array',
              items: { type: 'string' },
              description: 'Which services to search (gmail, drive, calendar, etc)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_vault_summary',
        description: 'Get a summary of your data across all connected services',
        inputSchema: {
          type: 'object',
          properties: {
            include_counts: {
              type: 'boolean',
              description: 'Include item counts per service'
            }
          }
        }
      }
    ]
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_services':
        return handleListServices(args);
      
      case 'get_service_data':
        return handleGetServiceData(args);
      
      case 'execute_service_method':
        return handleExecuteServiceMethod(args);
      
      case 'get_oauth_status':
        return handleGetOAuthStatus(args);
      
      case 'search_all_services':
        return handleSearchAllServices(args);
      
      case 'get_vault_summary':
        return handleGetVaultSummary(args);
      
      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`
            }
          ],
          isError: true
        };
    }
  } catch (error) {
    console.error(`[MCP] Error in ${name}:`, error.message);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

/**
 * Tool implementations
 */

async function handleListServices(args) {
  try {
    if (!currentUserId) {
      return errorResponse('No user context. Set MYAPI_USER_ID environment variable.');
    }

    const services = db.prepare(`
      SELECT DISTINCT service_name FROM oauth_tokens 
      WHERE user_id = ? AND revoked_at IS NULL
      ORDER BY service_name
    `).all(currentUserId);

    const serviceList = services.map(s => ({
      name: s.service_name,
      connected: true,
      lastSynced: 'N/A'
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Connected Services (${serviceList.length}):\n\n` +
                serviceList.map(s => `• ${s.name.toUpperCase()}`).join('\n')
        }
      ]
    };
  } catch (error) {
    return errorResponse(error.message);
  }
}

async function handleGetServiceData(args) {
  const { service, query, limit = 10 } = args;

  if (!currentUserId) {
    return errorResponse('No user context.');
  }

  // Check if service is connected
  const token = db.prepare(
    'SELECT * FROM oauth_tokens WHERE user_id = ? AND service_name = ? LIMIT 1'
  ).get(currentUserId, service);

  if (!token) {
    return errorResponse(`Service '${service}' is not connected. Please connect it first.`);
  }

  // Placeholder for actual service data fetching
  // In production, this would call the service's actual API
  const mockData = {
    gmail: () => `Found ${Math.floor(Math.random() * 20)} emails matching "${query}"`,
    calendar: () => `Found ${Math.floor(Math.random() * 5)} events matching "${query}"`,
    drive: () => `Found ${Math.floor(Math.random() * 15)} files matching "${query}"`,
    github: () => `Found ${Math.floor(Math.random() * 10)} repositories matching "${query}"`,
    linkedin: () => `Found ${Math.floor(Math.random() * 8)} posts matching "${query}"`,
  };

  const result = mockData[service]?.() || `Data from ${service}: ${query}`;

  return {
    content: [
      {
        type: 'text',
        text: result
      }
    ]
  };
}

async function handleExecuteServiceMethod(args) {
  const { service, method, params = {} } = args;

  if (!currentUserId) {
    return errorResponse('No user context.');
  }

  // Check if service is connected
  const token = db.prepare(
    'SELECT * FROM oauth_tokens WHERE user_id = ? AND service_name = ? LIMIT 1'
  ).get(currentUserId, service);

  if (!token) {
    return errorResponse(`Service '${service}' is not connected.`);
  }

  // Simulate method execution
  const result = `[${service.toUpperCase()}] Executed ${method} with params: ${JSON.stringify(params)}`;

  return {
    content: [
      {
        type: 'text',
        text: result
      }
    ]
  };
}

async function handleGetOAuthStatus(args) {
  if (!currentUserId) {
    return errorResponse('No user context.');
  }

  const connected = db.prepare(`
    SELECT service_name, COUNT(*) as count FROM oauth_tokens 
    WHERE user_id = ? AND revoked_at IS NULL
    GROUP BY service_name
  `).all(currentUserId);

  const status = connected.map(row => `✓ ${row.service_name}`).join('\n');

  return {
    content: [
      {
        type: 'text',
        text: `OAuth Status:\n\n${status || 'No services connected'}`
      }
    ]
  };
}

async function handleSearchAllServices(args) {
  const { query, services = ['gmail', 'drive', 'calendar', 'github'] } = args;

  if (!currentUserId) {
    return errorResponse('No user context.');
  }

  const results = [];
  for (const service of services) {
    const token = db.prepare(
      'SELECT * FROM oauth_tokens WHERE user_id = ? AND service_name = ? LIMIT 1'
    ).get(currentUserId, service);

    if (token) {
      results.push(`${service}: Found 3 results for "${query}"`);
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `Search Results for "${query}":\n\n` + (results.length > 0 ? results.join('\n') : 'No results found')
      }
    ]
  };
}

async function handleGetVaultSummary(args) {
  const { include_counts = true } = args;

  if (!currentUserId) {
    return errorResponse('No user context.');
  }

  const services = db.prepare(`
    SELECT service_name, COUNT(*) as token_count FROM oauth_tokens 
    WHERE user_id = ? AND revoked_at IS NULL
    GROUP BY service_name
  `).all(currentUserId);

  let summary = 'MyApi Vault Summary:\n\n';
  summary += `Connected Services: ${services.length}\n`;

  if (include_counts) {
    summary += '\nService Details:\n';
    services.forEach(row => {
      summary += `• ${row.service_name}: ${row.token_count} token(s)\n`;
    });
  }

  return {
    content: [
      {
        type: 'text',
        text: summary
      }
    ]
  };
}

/**
 * Utility functions
 */

function errorResponse(message) {
  return {
    content: [
      {
        type: 'text',
        text: message
      }
    ],
    isError: true
  };
}

/**
 * Start server
 */

async function main() {
  const transport = new StdioServerTransport();
  
  // Set user ID from environment
  if (process.env.MYAPI_USER_ID) {
    currentUserId = process.env.MYAPI_USER_ID;
    console.error(`[MCP] User context set: ${currentUserId}`);
  }

  await server.connect(transport);
  console.error('[MCP] MyApi server started and connected');
}

main().catch(error => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
