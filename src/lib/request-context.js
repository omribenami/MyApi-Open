/**
 * Request context propagation via AsyncLocalStorage.
 * Allows audit log functions to read requestId without being explicitly passed it.
 *
 * SOC2 CC7 Phase 2 — correlation ID support.
 *
 * The store also carries the request ACTOR (auth type, token, device) so audit
 * writes anywhere in the call stack can attribute the action to the device that
 * initiated it without threading req through every function, plus an `audited`
 * flag used by the API-call accounting middleware to know whether an
 * endpoint-specific audit row was already written for this request.
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
  requestContext.run({ requestId, actor: {}, audited: false }, next);
}

/**
 * Get the current request ID (if called from within a request context).
 * Returns null when called outside a request (e.g., startup, timers).
 */
function getCurrentRequestId() {
  const store = requestContext.getStore();
  return store ? store.requestId : null;
}

/**
 * Merge actor fields into the current request context. Called from the auth
 * middleware (authType/token) and the device-approval middleware (device).
 * Fields: authType, tokenId, tokenLabel, tokenType, deviceId, deviceName, userAgent.
 */
function setRequestActor(fields) {
  const store = requestContext.getStore();
  if (store && fields) Object.assign(store.actor, fields);
}

function getRequestActor() {
  const store = requestContext.getStore();
  return store ? store.actor : null;
}

/** Mark that an endpoint-specific audit row was written for this request. */
function markAudited() {
  const store = requestContext.getStore();
  if (store) store.audited = true;
}

/**
 * Direct reference to the live store object. EventEmitter callbacks (e.g.
 * res.on('finish')) run OUTSIDE the ALS context, so middleware that needs
 * post-response access must capture this reference during the request.
 */
function getRequestStore() {
  return requestContext.getStore() || null;
}

module.exports = {
  requestContextMiddleware,
  getCurrentRequestId,
  setRequestActor,
  getRequestActor,
  markAudited,
  getRequestStore,
};
