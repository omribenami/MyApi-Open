const DEFAULT_EXECUTION_CONTRACT = {
  transport: 'http',
  timeoutMs: 10000,
  retries: {
    maxAttempts: 3,
    strategy: 'exponential_backoff_with_jitter',
    baseDelayMs: 250,
    maxDelayMs: 3000,
    retryOn: ['429', '5xx', 'network_error'],
  },
  responseShape: {
    ok: 'boolean',
    service: 'string',
    method: 'string',
    statusCode: 'number|null',
    data: 'object|null',
    error: 'object|null',
    meta: 'object',
  },
};

const OAUTH_PROVIDER_DETAILS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    apiRoot: 'https://www.googleapis.com',
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    apiRoot: 'https://api.github.com',
    docsUrl: 'https://docs.github.com/en/apps/oauth-apps',
  },
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    apiRoot: 'https://slack.com/api',
    docsUrl: 'https://api.slack.com/authentication/oauth-v2',
  },
  discord: {
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    apiRoot: 'https://discord.com/api',
    docsUrl: 'https://discord.com/developers/docs/topics/oauth2',
  },
  whatsapp: {
    authUrl: null,
    tokenUrl: null,
    apiRoot: 'https://graph.facebook.com',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    apiRoot: 'https://graph.facebook.com',
    docsUrl: 'https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow',
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    apiRoot: 'https://graph.instagram.com',
    docsUrl: 'https://developers.facebook.com/docs/instagram-basic-display-api/getting-started',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    apiRoot: 'https://open.tiktokapis.com',
    docsUrl: 'https://developers.tiktok.com/doc/login-kit-web',
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    apiRoot: 'https://api.twitter.com/2',
    docsUrl: 'https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code',
  },
  reddit: {
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    apiRoot: 'https://oauth.reddit.com',
    docsUrl: 'https://github.com/reddit-archive/reddit/wiki/OAuth2',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    apiRoot: 'https://api.linkedin.com',
    docsUrl: 'https://learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow',
  },
  fal: {
    authUrl: null,
    tokenUrl: null,
    apiRoot: 'https://fal.run',
    docsUrl: 'https://fal.ai/models',
  },
};

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getProviderDetails(serviceName) {
  return OAUTH_PROVIDER_DETAILS[String(serviceName || '').toLowerCase()] || null;
}

function synthesizeMethod(service) {
  return {
    methodName: 'default_request',
    httpMethod: 'GET',
    endpoint: service.apiEndpoint || service.api_endpoint || null,
    description: `Default method for ${service.label || service.name}`,
    parameters: [],
    validation: {
      paramsRequired: false,
      paramsType: 'object',
    },
  };
}

function normalizeMethod(methodRow) {
  const parameters = safeJsonParse(methodRow.parameters, []);
  const responseExample = safeJsonParse(methodRow.response_example, null);

  return {
    id: methodRow.id,
    methodName: methodRow.method_name,
    httpMethod: String(methodRow.http_method || 'GET').toUpperCase(),
    endpoint: methodRow.endpoint,
    description: methodRow.description || '',
    parameters,
    responseExample,
    validation: {
      paramsRequired: Array.isArray(parameters) ? parameters.some((p) => p?.required) : false,
      paramsType: 'object',
    },
  };
}

function buildServiceDefinition(serviceRow, methodRows = []) {
  const methods = (methodRows || []).map(normalizeMethod);
  const effectiveMethods = methods.length > 0 ? methods : [synthesizeMethod(serviceRow)];
  const provider = getProviderDetails(serviceRow.name);

  return {
    id: serviceRow.id,
    name: serviceRow.name,
    label: serviceRow.label,
    category: serviceRow.category_name || null,
    categoryLabel: serviceRow.category_label || null,
    authType: serviceRow.auth_type,
    description: serviceRow.description || null,
    icon: serviceRow.icon || null,
    apiEndpoint: serviceRow.api_endpoint || null,
    documentationUrl: serviceRow.documentation_url || provider?.docsUrl || null,
    authUrls: provider
      ? {
          authUrl: provider.authUrl,
          tokenUrl: provider.tokenUrl,
          apiRoot: provider.apiRoot,
        }
      : null,
    methods: effectiveMethods,
    executionContract: DEFAULT_EXECUTION_CONTRACT,
  };
}

function validateExecutionInput(serviceDef, requestedMethod, params) {
  if (!requestedMethod || typeof requestedMethod !== 'string') {
    return { ok: false, status: 400, error: 'method is required' };
  }

  const method = serviceDef.methods.find((m) => m.methodName === requestedMethod);
  if (!method) {
    return {
      ok: false,
      status: 404,
      error: `Unknown method '${requestedMethod}' for service '${serviceDef.name}'`,
      code: 'METHOD_NOT_FOUND',
    };
  }

  if (params !== undefined && (typeof params !== 'object' || Array.isArray(params))) {
    return {
      ok: false,
      status: 400,
      error: 'params must be an object when provided',
      code: 'INVALID_PARAMS',
    };
  }

  return { ok: true, method };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, retries = DEFAULT_EXECUTION_CONTRACT.retries) {
  let attempt = 0;
  let lastError;

  while (attempt < retries.maxAttempts) {
    attempt += 1;
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const status = Number(error?.statusCode || error?.status || 0);
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt >= retries.maxAttempts) break;
      const base = retries.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 100);
      await sleep(Math.min(base + jitter, retries.maxDelayMs));
    }
  }

  throw lastError;
}

function toErrorMessage(value, fallback = 'Service execution failed') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeExecutionError(error, serviceName, methodName) {
  const message = toErrorMessage(error?.providerError ?? error?.message ?? error, 'Service execution failed');
  return {
    ok: false,
    service: serviceName,
    method: methodName,
    statusCode: Number(error?.statusCode || error?.status || 500),
    data: null,
    error: {
      code: error?.code || 'INTEGRATION_ERROR',
      message,
      retryable: !error?.statusCode || error.statusCode === 429 || error.statusCode >= 500,
      providerError: error?.providerError || null,
    },
    meta: {
      timestamp: new Date().toISOString(),
      endpoint: error?.endpoint || null,
      httpMethod: error?.httpMethod || null,
    },
  };
}

async function executeServiceMethod({ serviceDef, method, params = {}, token = null }) {
  const provider = getProviderDetails(serviceDef.name);
  const apiRoot = provider?.apiRoot || serviceDef.apiEndpoint;

  // Allow endpoint/path override for generic methods (e.g. default_request)
  // so callers can hit concrete provider routes like /me.
  const effectiveParams = (params && typeof params === 'object' && !Array.isArray(params)) ? { ...params } : {};
  const endpointOverrideRaw = effectiveParams.endpoint || effectiveParams.path;
  const endpointOverride = (typeof endpointOverrideRaw === 'string' && endpointOverrideRaw.trim())
    ? endpointOverrideRaw.trim()
    : null;
  const methodOverrideRaw = effectiveParams.method;
  const methodOverride = (typeof methodOverrideRaw === 'string' && methodOverrideRaw.trim())
    ? methodOverrideRaw.trim().toUpperCase()
    : null;
  delete effectiveParams.endpoint;
  delete effectiveParams.path;
  delete effectiveParams.method;

  const methodEndpoint = endpointOverride || method.endpoint;

  // Explicit unsupported method stubs for MVP-safe service contracts.
  if (typeof methodEndpoint === 'string' && methodEndpoint.startsWith('unsupported://')) {
    return {
      ok: false,
      service: serviceDef.name,
      method: method.methodName,
      statusCode: 501,
      data: null,
      error: {
        code: 'METHOD_UNSUPPORTED',
        message: `${serviceDef.name}/${method.methodName} is not supported in this MyApi MVP integration`,
      },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  // If no apiRoot or no endpoint on the method, return a helpful error
  if (!apiRoot && !methodEndpoint) {
    return {
      ok: false,
      service: serviceDef.name,
      method: method.methodName,
      statusCode: 501,
      data: null,
      error: { code: 'NO_ENDPOINT', message: `No API endpoint configured for ${serviceDef.name}/${method.methodName}` },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  try {
    const payload = await withRetry(async () => {
      const https = require('https');
      const http = require('http');

      // BUG-13: Add try-catch around URL construction to handle invalid URLs
      let targetUrl;
      try {
        // Build URL: if method endpoint is absolute use it, otherwise combine with apiRoot
        if (methodEndpoint && (methodEndpoint.startsWith('http://') || methodEndpoint.startsWith('https://'))) {
          targetUrl = new URL(methodEndpoint);
        } else {
          const base = apiRoot.endsWith('/') ? apiRoot.slice(0, -1) : apiRoot;
          const ep = (methodEndpoint || '').startsWith('/') ? methodEndpoint : `/${methodEndpoint || ''}`;
          targetUrl = new URL(base + ep);
        }

        // Interpolate path params like :owner, :repo, {owner}, {repo}
        if (effectiveParams) {
          let pathname = targetUrl.pathname;
          for (const [k, v] of Object.entries(effectiveParams)) {
            pathname = pathname.replace(`:${k}`, encodeURIComponent(v));
            pathname = pathname.replace(`{${k}}`, encodeURIComponent(v));
          }
          targetUrl.pathname = pathname;
        }
      } catch (urlError) {
        console.error('[Integration Layer] URL construction failed:', {
          apiRoot,
          methodEndpoint,
          params: effectiveParams,
          error: urlError.message
        });
        throw new Error(`Invalid URL construction: ${urlError.message}`);
      }

      // For GET requests, add non-path params as query params
      const httpMethod = (methodOverride || method.httpMethod || 'GET').toUpperCase();
      if (httpMethod === 'GET' && effectiveParams) {
        for (const [k, v] of Object.entries(effectiveParams)) {
          if (!methodEndpoint || (!methodEndpoint.includes(`:${k}`) && !methodEndpoint.includes(`{${k}}`))) {
            targetUrl.searchParams.set(k, v);
          }
        }
      }

      const transport = targetUrl.protocol === 'https:' ? https : http;

      // Build headers with auth
      const headers = {
        'Accept': 'application/json',
        'User-Agent': 'MyApi-Gateway/1.0',
      };

      if (token && token.accessToken) {
        // Different auth header patterns per provider
        if (serviceDef.name === 'github') {
          headers['Authorization'] = `token ${token.accessToken}`;
        } else if (serviceDef.name === 'fal') {
          headers['Authorization'] = `Key ${token.accessToken}`;
        } else {
          headers['Authorization'] = `Bearer ${token.accessToken}`;
        }
      }

      let body = null;
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod) && effectiveParams) {
        body = JSON.stringify(effectiveParams);
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(body);
      }

      const result = await new Promise((resolve, reject) => {
        const req = transport.request(targetUrl, { method: httpMethod, headers }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            let parsed;
            try { parsed = JSON.parse(data); } catch { parsed = data; }
            resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
          });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });

      if (result.statusCode >= 400) {
        const providerError = (result.data && typeof result.data === 'object')
          ? (result.data.error ?? result.data.message ?? result.data)
          : result.data;

        const error = new Error(toErrorMessage(providerError, 'Service execution failed'));
        error.statusCode = result.statusCode;
        error.code = result.data?.code || 'PROVIDER_ERROR';
        error.providerError = providerError;
        error.endpoint = targetUrl.toString();
        error.httpMethod = httpMethod;
        throw error;
      }

      return {
        ok: true,
        service: serviceDef.name,
        method: method.methodName,
        statusCode: result.statusCode,
        data: result.data,
        error: null,
        meta: {
          timestamp: new Date().toISOString(),
          endpoint: targetUrl.toString(),
          httpMethod,
        },
      };
    });

    return payload;
  } catch (error) {
    return normalizeExecutionError(error, serviceDef.name, method.methodName);
  }
}

module.exports = {
  buildServiceDefinition,
  validateExecutionInput,
  executeServiceMethod,
  normalizeExecutionError,
  DEFAULT_EXECUTION_CONTRACT,
  OAUTH_PROVIDER_DETAILS,
};