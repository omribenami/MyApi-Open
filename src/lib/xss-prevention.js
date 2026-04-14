
// ============================================================================
// SECURITY FIX: XSS (Cross-Site Scripting) Prevention
// CVSS: 6.1 (Medium)
// ============================================================================

const DOMPurify = require('isomorphic-dompurify');

/**
 * Sanitize HTML content - for rich text, markdown editors
 * CVSS 6.1: XSS via dangerouslySetInnerHTML in KnowledgeBase.jsx
 */
// Explicitly forbid all event handler attributes (defense in depth — DOMPurify
// strips these by default, but explicit denylisting makes the intent clear).
const FORBIDDEN_ATTRS = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
  'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress',
  'onmouseenter', 'onmouseleave', 'ondblclick', 'oncontextmenu',
  'ondragstart', 'ondrop', 'onscroll', 'onwheel', 'onpaste',
  'oncopy', 'oncut', 'oninput', 'onreset', 'onsearch', 'onselect',
  'onabort', 'oncanplay', 'oncanplaythrough', 'oncuechange',
  'ondurationchange', 'onemptied', 'onended', 'onerror',
  'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onpause',
  'onplay', 'onplaying', 'onprogress', 'onratechange', 'onseeked',
  'onseeking', 'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange',
  'onwaiting', 'onanimationstart', 'onanimationend', 'onanimationiteration',
  'ontransitionend', 'onformdata', 'onpointerdown', 'onpointerup',
  'onpointermove', 'onpointercancel', 'onpointerenter', 'onpointerleave',
  'onpointerover', 'onpointerout', 'ontouchstart', 'ontouchmove',
  'ontouchend', 'ontouchcancel'
];

// DOMPurify hook: add rel="noopener noreferrer" to all target="_blank" links
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function sanitizeHTML(dirty, allowedTags = ['p', 'br', 'strong', 'em', 'u', 'a']) {
  if (!dirty) return '';

  const config = {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    FORBID_ATTR: FORBIDDEN_ATTRS,
    KEEP_CONTENT: true,
    FORCE_BODY: true
  };

  return DOMPurify.sanitize(dirty, config);
}

/**
 * Escape HTML entities - for plain text that might contain <, >, etc
 * CVSS 6.1: XSS via unsanitized URL parameters
 */
function escapeHTML(text) {
  if (!text || typeof text !== 'string') return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Sanitize URLs - prevent javascript: and data: protocols
 * CVSS 6.1: Open redirect and XSS via URL parameters
 */
function sanitizeURL(url) {
  if (!url || typeof url !== 'string') return '';
  
  // Block dangerous protocols
  const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerURL = url.toLowerCase().trim();
  
  if (dangerous.some(proto => lowerURL.startsWith(proto))) {
    return '';
  }
  
  // For relative URLs, ensure they start with / or ?
  if (lowerURL.startsWith('http://') || lowerURL.startsWith('https://')) {
    try {
      new URL(url);
      return url;
    } catch {
      return '';
    }
  }
  
  // Relative URL
  if (lowerURL.startsWith('/') || lowerURL.startsWith('?') || lowerURL.startsWith('#')) {
    return url;
  }
  
  return '';
}

/**
 * Content Security Policy headers
 * CVSS 6.1: Missing CSP headers
 */
const cspHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // unsafe-inline required for Tailwind/CSS-in-JS; scope further if feasible
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests"
  ].join('; ')
};

/**
 * React component - safe rendering with sanitization
 */
function SafeHTML({ content, allowedTags }) {
  const sanitized = sanitizeHTML(content, allowedTags);
  return React.createElement('div', {
    dangerouslySetInnerHTML: { __html: sanitized }
  });
}

/**
 * Safe attribute binding
 */
function SafeLink({ href, children, ...props }) {
  const safeHref = sanitizeURL(href);
  
  if (!safeHref) {
    return React.createElement('span', null, children);
  }
  
  return React.createElement('a', { href: safeHref, ...props }, children);
}

module.exports = {
  sanitizeHTML,
  escapeHTML,
  sanitizeURL,
  cspHeaders,
  SafeHTML,
  SafeLink
};
