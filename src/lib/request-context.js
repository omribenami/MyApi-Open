/**
 * Request context propagation via AsyncLocalStorage.
 * Allows audit log functions to read requestId without being explicitly passed it.
 *
 * SOC2 CC7 Phase 2 — correlation ID support.
 */

const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();

/**
 * Express middleware: sets requestId (from X-Request-ID header or new UUID)
 * and exposes it via AsyncLocalStorage for the duration of the request.
 */
function requestContextMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  requestContext.run({ requestId }, next);
}

/**
 * Get the current request ID (if called from within a request context).
 * Returns null when called outside a request (e.g., startup, timers).
 */
function getCurrentRequestId() {
  const store = requestContext.getStore();
  return store ? store.requestId : null;
}

module.exports = { requestContextMiddleware, getCurrentRequestId };
