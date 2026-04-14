
// ============================================================================
// SECURITY FIX: SSRF (Server-Side Request Forgery) & Open Redirect Prevention
// CVSS: 7.5 (High)
// ============================================================================

const url = require('url');

/**
 * Whitelist-based URL validation
 * CVSS 7.5: Unrestricted HTTP client requests
 */
const ALLOWED_DOMAINS = [
  'api.github.com',
  'api.slack.com',
  'api.notion.com',
  'graph.microsoft.com',
  'www.googleapis.com',
  'discord.com',
  'api.stripe.com'
];

const FORBIDDEN_PROTOCOLS = ['file:', 'data:', 'javascript:', 'about:'];

function validateURL(targetUrl, allowedDomains = ALLOWED_DOMAINS) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    throw new Error('Invalid URL');
  }
  
  try {
    const parsed = new URL(targetUrl);
    
    // Block dangerous protocols
    if (FORBIDDEN_PROTOCOLS.includes(parsed.protocol)) {
      throw new Error(`Protocol not allowed: ${parsed.protocol}`);
    }
    
    // Whitelist allowed domains
    if (!allowedDomains.includes(parsed.hostname)) {
      throw new Error(`Domain not allowed: ${parsed.hostname}`);
    }
    
    // Ensure HTTPS for external requests
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only HTTP/HTTPS allowed');
    }
    
    return parsed;
  } catch (e) {
    throw new Error(`URL validation failed: ${e.message}`);
  }
}

/**
 * Safe redirect handler
 * CVSS 6.1: Open redirect via unsanitized redirect_to parameter
 */
function validateRedirectURL(redirectTo) {
  if (!redirectTo || typeof redirectTo !== 'string') {
    return '/dashboard'; // Safe default
  }
  
  // Allow relative URLs only (same-origin redirects)
  if (redirectTo.startsWith('/')) {
    // Prevent //example.com redirects (protocol-relative)
    if (redirectTo.startsWith('//')) {
      return '/dashboard';
    }
    return redirectTo;
  }
  
  // Block external redirects entirely
  try {
    new URL(redirectTo);
    // If it's a valid absolute URL, it's external - block it
    return '/dashboard';
  } catch {
    // Not a valid URL, treat as relative
    if (redirectTo.startsWith('?') || redirectTo.startsWith('#')) {
      return redirectTo;
    }
  }
  
  // Default safe fallback
  return '/dashboard';
}

/**
 * Safe HTTP client wrapper
 * CVSS 7.5: Unrestricted service proxy
 */
class SafeHTTPClient {
  constructor(allowedDomains = ALLOWED_DOMAINS) {
    this.allowedDomains = allowedDomains;
    this.timeout = 5000; // 5 second timeout
  }
  
  async get(targetUrl) {
    const validated = validateURL(targetUrl, this.allowedDomains);
    
    // Use fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(validated.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MyApi/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  async post(targetUrl, data) {
    const validated = validateURL(targetUrl, this.allowedDomains);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(validated.toString(), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MyApi/1.0'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

module.exports = {
  validateURL,
  validateRedirectURL,
  SafeHTTPClient,
  ALLOWED_DOMAINS,
  FORBIDDEN_PROTOCOLS
};
