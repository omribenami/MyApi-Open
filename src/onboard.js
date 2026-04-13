const express = require('express');
const fs = require('fs');
const path = require('path');
const { clearUserOnboarding, getUserById, updateUserOAuthProfile } = require('./database');

function isOwnerUser(userId) {
  if (!userId) return false;
  if (userId === 'owner') return true;
  try {
    const ownerEmail = String(
      process.env.POWER_USER_EMAIL || process.env.OWNER_EMAIL || ''
    ).trim().toLowerCase();
    if (!ownerEmail) return false;
    const user = getUserById(userId);
    return String(user?.email || '').toLowerCase() === ownerEmail;
  } catch (_) { return false; }
}

const router = express.Router();

// USER.md location (from MyApi's perspective, project root)
const USER_MD_PATH = process.env.USER_MD_PATH || path.join(__dirname, '..','..','..','USER.md');

function ensureUserMd() {
  if (!fs.existsSync(USER_MD_PATH)) {
    fs.writeFileSync(USER_MD_PATH, '# USER.md - About Your Human\n\n');
  }
}

function upsertField(md, key, value) {
  if (value === undefined || value === null) return md;
  const marker = `- **${key}**:`;
  const lines = md.split('\n');
  const idx = lines.findIndex(l => l.trim().startsWith(marker));
  if (idx >= 0) {
    lines[idx] = `- **${key}**: ${value}`;
  } else {
    lines.push(`- **${key}**: ${value}`);
  }
  return lines.join('\n');
}

// Onboard step 1: identity/profile
router.post('/onboard/step1', express.json(), (req, res) => {
  const payload = req.body || {};
  const userId = req.session?.user?.id;

  // SECURITY FIX (HIGH - CVSS 7.3): Authorization check
  // Ensure the session user ID matches and is valid
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: No valid user session' });
  }

  // Only allow users to update their own profile, except owner updating general USER.md
  if (req.session?.user?.id !== userId) {
    return res.status(403).json({ error: 'Forbidden: Cannot update another user profile' });
  }

  // Only write USER.md for the platform owner — non-owner users must never touch
  // this file or they will overwrite the owner's display name / profile.
  if (isOwnerUser(userId)) {
    ensureUserMd();
    let md = fs.readFileSync(USER_MD_PATH, 'utf8');
    md = upsertField(md, 'Name', payload.name);
    md = upsertField(md, 'Role', payload.role);
    md = upsertField(md, 'Bio', payload.bio);
    md = upsertField(md, 'Skills', payload.skills);
    md = upsertField(md, 'Company', payload.company);
    md = upsertField(md, 'Location', payload.location);
    md = upsertField(md, 'Timezone', payload.timezone);
    md = upsertField(md, 'Email', payload.email);
    fs.writeFileSync(USER_MD_PATH, md);
  }

  // Persist identity fields to the user's DB profile so the Identity page
  // pre-populates correctly for all users.
  // Keys use the capitalized PROFILE_FIELDS convention (Name, Occupation, Bio, …)
  if (userId) {
    try {
      const current = getUserById(String(userId));
      if (current) {
        let existingMeta = {};
        try { existingMeta = current.profile_metadata ? JSON.parse(current.profile_metadata) : {}; } catch (_) {}

        const profileUpdate = {};
        if (payload.name)     profileUpdate.Name     = payload.name;
        if (payload.role)     profileUpdate.Role     = payload.role;
        if (payload.bio)      profileUpdate.Bio      = payload.bio;
        if (payload.company)  profileUpdate.Company    = payload.company;
        if (payload.location) profileUpdate.Location   = payload.location;

        updateUserOAuthProfile(String(userId), {
          displayName:     payload.name || undefined,
          profileMetadata: { ...existingMeta, ...profileUpdate },
        });
      }
    } catch (_) {}

    // Clear the onboarding flag (DB + session)
    clearUserOnboarding(String(userId));
    if (req.session?.user) {
      req.session.user.needsOnboarding = false;
      req.session.save?.(() => {});
    }
  }

  res.json({ ok: true, updated: true, fields: ['Name','Role','Bio','Skills','Company','Location','Timezone','Email'] });
});

// Onboard step 2: connectors preference (store small config, keyed by userId)
router.post('/onboard/step2', express.json(), (req, res) => {
  const data = req.body || {};
  const userId = req.session?.user?.id;
  const cfgPath = path.join(__dirname, '..','..','..','onboard_connectors.json');
  let existing = {};
  try { if (fs.existsSync(cfgPath)) existing = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (_) {}
  if (userId) existing[userId] = data.connectors || [];
  fs.writeFileSync(cfgPath, JSON.stringify(existing), 'utf8');
  res.json({ ok: true, step2: true, connectors: data.connectors || [] });
});

// Onboard step 3: initial tokens (starter vault tokens)
// We'll create a starter vault token as part of onboarding to accelerate initial setup
const { createVaultToken, initDatabase } = require('./database');
router.post('/onboard/step3', express.json(), (req, res) => {
  // Simple starter token if not exists
  const payload = req.body || {};
  // Example starter tokens
  const label = payload.label || 'Onboard Starter Token';
  const description = payload.description || 'Token created during onboarding';
  const starterToken = payload.token || 'starter-token';
  try {
    const t = createVaultToken(label, description, starterToken);
    res.json({ ok: true, step3: true, token: t });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/onboard/steps', (req, res) => {
  res.json({ steps: [
    { id: 'step1', title: 'Identity', done: fs.existsSync(USER_MD_PATH) },
    { id: 'step2', title: 'Connectors', done: false },
    { id: 'step3', title: 'Initial Vault', done: false }
  ]});
});

module.exports = router;
