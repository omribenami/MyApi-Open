
// ============================================================================
// SECURITY FIX: SSRF (Server-Side Request Forgery) & Open Redirect Prevention
// CVSS: 7.5–8.2 (High)
// ============================================================================

const net = require('net');
const dns = require('dns');

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

/**
 * Returns true if the IP string is in a private/reserved range.
 * Covers IPv4 and IPv6 reserved ranges.
 */
function isPrivateIP(ip) {
  if (!ip) return false;

  // Normalize IPv6-mapped IPv4 (::ffff:10.0.0.1 → 10.0.0.1)
  const normalized = ip.replace(/^::ffff:/i, '');

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 127 ||                             // 127.0.0.0/8  loopback
      a === 10 ||                              // 10.0.0.0/8   private
      (a === 172 && b >= 16 && b <= 31) ||    // 172.16.0.0/12 private
      (a === 192 && b === 168) ||             // 192.168.0.0/16 private
      (a === 169 && b === 254) ||             // 169.254.0.0/16 link-local / IMDS
      (a === 0) ||                             // 0.0.0.0/8    invalid
      (a === 100 && b >= 64 && b <= 127) ||   // 100.64.0.0/10 shared address
      (a === 192 && b === 0 && parts[2] === 0) || // 192.0.0.0/24 IETF protocol
      (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
      (a === 240)                              // 240.0.0.0/4  reserved
    );
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' ||                         // loopback
      lower.startsWith('fc') ||                  // fc00::/7 ULA
      lower.startsWith('fd') ||                  // fc00::/7 ULA
      lower.startsWith('fe80') ||               // fe80::/10 link-local
      lower.startsWith('::ffff:') ||            // IPv4-mapped
      lower === '::' ||                          // unspecified
      lower.startsWith('100::')                  // discard prefix
    );
  }

  return false;
}

/**
 * Async URL validator. Validates protocol, domain allowlist, private-IP literals,
 * and performs DNS resolution to block DNS rebinding attacks.
 * CVSS 7.5–8.2: SSRF prevention
 */
async function validateURL(targetUrl, allowedDomains = ALLOWED_DOMAINS) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    throw new Error('Invalid URL');
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    throw new Error(`URL validation failed: malformed URL`);
  }

  // Block dangerous protocols
  if (FORBIDDEN_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(`Protocol not allowed: ${parsed.protocol}`);
  }

  // Only HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS allowed');
  }

  const hostname = parsed.hostname;

  // If the hostname is already an IP literal, block private ranges immediately
  if (net.isIP(hostname) !== 0) {
    if (isPrivateIP(hostname)) {
      throw new Error(`Access to private/reserved IP addresses not allowed: ${hostname}`);
    }
    // IP literals are not in the domain allowlist — block them
    throw new Error(`Direct IP access not allowed; use a whitelisted hostname`);
  }

  // Domain allowlist check
  if (!allowedDomains.includes(hostname)) {
    throw new Error(`Domain not allowed: ${hostname}`);
  }

  // DNS rebinding protection: resolve and validate each resolved IP
  let addresses;
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch (e) {
    throw new Error(`DNS resolution failed for ${hostname}: ${e.message}`);
  }

  for (const { address } of addresses) {
    if (isPrivateIP(address)) {
      throw new Error(`DNS rebinding detected: ${hostname} resolves to private IP ${address}`);
    }
  }

  return parsed;
}

/**
 * Synchronous URL validator (no DNS check) — use only when async is impossible.
 * Does NOT protect against DNS rebinding. Prefer validateURL() where possible.
 */
function validateURLSync(targetUrl, allowedDomains = ALLOWED_DOMAINS) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    throw new Error('Invalid URL');
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    throw new Error(`URL validation failed: malformed URL`);
  }

  if (FORBIDDEN_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(`Protocol not allowed: ${parsed.protocol}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS allowed');
  }

  const hostname = parsed.hostname;

  if (net.isIP(hostname) !== 0) {
    if (isPrivateIP(hostname)) {
      throw new Error(`Access to private/reserved IP addresses not allowed: ${hostname}`);
    }
    throw new Error(`Direct IP access not allowed; use a whitelisted hostname`);
  }

  if (!allowedDomains.includes(hostname)) {
    throw new Error(`Domain not allowed: ${hostname}`);
  }

  return parsed;
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
    const validated = await validateURL(targetUrl, this.allowedDomains);

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
    const validated = await validateURL(targetUrl, this.allowedDomains);
    
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
  validateURLSync,
  validateRedirectURL,
  SafeHTTPClient,
  ALLOWED_DOMAINS,
  FORBIDDEN_PROTOCOLS,
  isPrivateIP
};
