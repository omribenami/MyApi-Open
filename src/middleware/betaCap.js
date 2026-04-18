'use strict';

const { isBetaMode, isBetaFull, getBetaMaxUsers } = require('../lib/betaMode');

function wantsHtml(req) {
  const accept = String(req.headers.accept || '').toLowerCase();
  return accept.includes('text/html');
}

function requireBetaSlot(req, res, next) {
  if (!isBetaMode()) return next();
  if (!isBetaFull()) return next();

  const payload = {
    error: 'Beta is at capacity. Join the waitlist to be notified when a spot opens.',
    code: 'BETA_FULL',
    waitlistUrl: '/api/v1/waitlist',
    betaMaxUsers: getBetaMaxUsers(),
  };

  if (wantsHtml(req)) {
    const email = req.query?.email || req.body?.email || '';
    const qs = email ? `?beta=full&email=${encodeURIComponent(email)}` : '?beta=full';
    return res.redirect(302, `/${qs}`);
  }

  return res.status(403).json(payload);
}

module.exports = { requireBetaSlot };
