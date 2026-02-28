const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// USER.md location (from MyApi's perspective, project root)
const USER_MD_PATH = path.join(__dirname, '..','..','..','USER.md');

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
  ensureUserMd();
  const payload = req.body || {};
  let md = fs.readFileSync(USER_MD_PATH, 'utf8');
  // Map common fields to identity md fields
  md = upsertField(md, 'Name', payload.name);
  md = upsertField(md, 'Role', payload.role);
  md = upsertField(md, 'Bio', payload.bio);
  md = upsertField(md, 'Skills', payload.skills);
  md = upsertField(md, 'Company', payload.company);
  md = upsertField(md, 'Location', payload.location);
  md = upsertField(md, 'Timezone', payload.timezone);
  md = upsertField(md, 'Email', payload.email);
  fs.writeFileSync(USER_MD_PATH, md);
  res.json({ ok: true, updated: true, fields: ['Name','Role','Bio','Skills','Company','Location','Timezone','Email'] });
});

// Onboard step 2: connectors preference (store small config)
router.post('/onboard/step2', express.json(), (req, res) => {
  // Persist connectors preferences in a small JSON file for MVP
  const data = req.body || {};
  const cfgPath = path.join(__dirname, '..','..','..','onboard_connectors.json');
  fs.writeFileSync(cfgPath, JSON.stringify(data.connectors || []), 'utf8');
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
