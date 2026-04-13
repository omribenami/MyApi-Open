'use strict';

const http  = require('http');
const https = require('https');
const net   = require('net');

// SECURITY FIX (HIGH - CVSS 7.5): SSRF Prevention
// Validate URLs to prevent Server-Side Request Forgery attacks
function isInternalIP(hostname) {
  // Block requests to internal/private IP ranges and localhost
  const internalPatterns = [
    /^localhost$/i,
    /^127\./,
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^::1$/,          // IPv6 loopback
    /^fe80:/,         // IPv6 link-local
    /^fc|^fd/,        // IPv6 private
    /^0\.0\.0\.0$/,
    /^169\.254\./,    // Link-local
    /^255\.255\.255\.255$/,
  ];
  
  return internalPatterns.some(pattern => pattern.test(hostname));
}

function validateUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Invalid protocol: ${parsed.protocol}. Only HTTP(S) is allowed.`);
    }
    
    // Block internal/private IP addresses
    if (isInternalIP(parsed.hostname)) {
      throw new Error(`Access to internal IP address blocked: ${parsed.hostname}`);
    }
    
    return parsed;
  } catch (err) {
    throw new Error(`URL validation failed: ${err.message}`);
  }
}

function httpRequest(method, url, body, headers = {}, redirects = 5) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = validateUrl(url);
      const lib    = parsed.protocol === 'https:' ? https : http;
      const data   = body ? JSON.stringify(body) : null;
      const opts   = {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method,
        headers:  {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
        // SECURITY: Enable strict TLS certificate validation for HTTPS
        rejectUnauthorized: true,
      };
      const req = lib.request(opts, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          try {
            const next = new URL(res.headers.location, url).toString();
            validateUrl(next); // Validate redirect target
            res.resume();
            return resolve(httpRequest(method, next, body, headers, redirects - 1));
          } catch (err) {
            res.resume();
            return reject(new Error(`Invalid redirect target: ${err.message}`));
          }
        }
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (_) { resolve({ status: res.statusCode, body: raw }); }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

function httpForm(url, formData, headers = {}, redirects = 5) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = validateUrl(url);
      const lib    = parsed.protocol === 'https:' ? https : http;
      const data   = new URLSearchParams(formData).toString();
      const opts   = {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
        // SECURITY: Enable strict TLS certificate validation for HTTPS
        rejectUnauthorized: true,
      };
      const req = lib.request(opts, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          try {
            const next = new URL(res.headers.location, url).toString();
            validateUrl(next); // Validate redirect target
            res.resume();
            return resolve(httpForm(next, formData, headers, redirects - 1));
          } catch (err) {
            res.resume();
            return reject(new Error(`Invalid redirect target: ${err.message}`));
          }
        }
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (_) { resolve({ status: res.statusCode, body: raw }); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { httpRequest, httpForm };
