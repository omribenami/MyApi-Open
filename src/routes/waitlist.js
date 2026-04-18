'use strict';

// Waitlist routes: email capture for users who hit the BETA user cap.
// POST /api/v1/waitlist is public (rate limited). Admin endpoints require master token.

const express = require('express');
const expressRateLimit = require('express-rate-limit');
const { addToWaitlist, listWaitlist, markWaitlistInvited, markWaitlistNotified } = require('../database');
const emailService = require('../services/emailService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function createWaitlistRoutes({ isMaster, authenticate } = {}) {
  const router = express.Router();
  const noopAuth = (req, _res, next) => next();
  const adminAuth = typeof authenticate === 'function' ? authenticate : noopAuth;

  const publicLimiter = expressRateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // POST /api/v1/waitlist — public email capture. Idempotent on duplicate email.
  router.post('/', publicLimiter, (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    try {
      const { entry, created } = addToWaitlist(email);
      if (created) {
        emailService.sendWaitlistConfirmationEmail(email).catch(() => {});
      }
      return res.status(created ? 201 : 200).json({
        data: {
          id: entry.id,
          email: entry.email,
          status: entry.status,
          alreadyOnWaitlist: !created,
        },
      });
    } catch (err) {
      console.error('[Waitlist] insert failed:', err);
      return res.status(500).json({ error: 'Failed to join waitlist' });
    }
  });

  // Admin helpers — gated by the same isMaster check index.js uses for other admin routes.
  router.get('/', adminAuth, (req, res) => {
    if (typeof isMaster === 'function' && !isMaster(req)) {
      return res.status(403).json({ error: 'Admin token required' });
    }
    const limit = Math.min(parseInt(req.query?.limit, 10) || 100, 500);
    const offset = Math.max(parseInt(req.query?.offset, 10) || 0, 0);
    return res.json({ data: listWaitlist({ limit, offset }) });
  });

  router.post('/:id/invite', adminAuth, (req, res) => {
    if (typeof isMaster === 'function' && !isMaster(req)) {
      return res.status(403).json({ error: 'Admin token required' });
    }
    const ok = markWaitlistInvited(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Waitlist entry not found or already invited' });
    return res.json({ data: { id: req.params.id, status: 'invited' } });
  });

  // POST /api/v1/waitlist/notify-launch — email every pending waitlist entry
  // announcing the beta is over. Idempotent re-runs re-email the same list;
  // pass ?skipNotified=1 to only email entries that have no notified_at yet.
  router.post('/notify-launch', adminAuth, async (req, res) => {
    if (typeof isMaster === 'function' && !isMaster(req)) {
      return res.status(403).json({ error: 'Admin token required' });
    }
    const skipNotified = String(req.query?.skipNotified || '').toLowerCase() === '1'
      || req.body?.skipNotified === true;
    try {
      const all = listWaitlist({ limit: 10000, offset: 0 });
      const targets = all.filter((e) => {
        if (e.status === 'converted') return false;
        if (skipNotified && e.notified_at) return false;
        return true;
      });
      const sent = [];
      const failed = [];
      for (const entry of targets) {
        try {
          await emailService.sendBetaLaunchEmail(entry.email);
          sent.push(entry.id);
        } catch (err) {
          failed.push({ id: entry.id, email: entry.email, error: err.message });
        }
      }
      markWaitlistNotified(sent);
      return res.json({
        data: {
          totalCandidates: targets.length,
          sent: sent.length,
          failed: failed.length,
          failures: failed,
        },
      });
    } catch (err) {
      console.error('[Waitlist] notify-launch failed:', err);
      return res.status(500).json({ error: 'Failed to send launch emails' });
    }
  });

  return router;
}

module.exports = createWaitlistRoutes;
