const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const {
  getUserById,
  getAccessTokens,
  getPersonas,
  getSkills,
  getKBDocuments,
  getKBDocumentById,
  getServices,
  getServicePreferences,
  getOAuthToken,
  getActivityLog,
} = require('../database');

const router = express.Router();

const EXPORT_SCHEMA_VERSION = '2.0';
const EXPORT_GENERATED_BY = 'myapi.export.v2';
const PORTABLE_MODE = 'portable';
const FORENSIC_MODE = 'forensic';
const ZIP_SCHEMA_VERSION = '3.0';
const ZIP_GENERATED_BY = 'myapi.export.v3.zip';
const EPHEMERAL_TOKEN_PATTERNS = [/oauth\s*session/i, /dashboard\s*session/i];
const SECRET_KEY_PATTERN = /(secret|token|password|passphrase|api[_-]?key|hash|refresh|access|authorization|cookie|session)/i;

function isEphemeralTokenLabel(label = '') {
  const value = String(label || '');
  return EPHEMERAL_TOKEN_PATTERNS.some((pattern) => pattern.test(value));
}

function maskTokenId(tokenId = '') {
  const value = String(tokenId || '');
  if (!value) return null;
  if (value.length <= 8) return '***';
  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

function checksumFor(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readTextFileIfExists(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function sanitizePortableObject(input) {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizePortableObject(item));
  }
  if (!input || typeof input !== 'object') {
    return input;
  }

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY_PATTERN.test(String(key))) {
      continue;
    }
    out[key] = sanitizePortableObject(value);
  }
  return out;
}

async function buildZipExport({ ownerId, workspaceId, exportMode, includeFiles }) {
  const withLegacyOwnerFallback = (loader) => {
    const primary = loader(ownerId);
    if (ownerId !== 'owner' && (!primary || primary.length === 0)) {
      return loader('owner');
    }
    return primary;
  };

  const user = getUserById(ownerId);
  const userMdPath = process.env.USER_MD_PATH || './USER.md';
  const soulMdPath = process.env.SOUL_MD_PATH || './SOUL.md';

  const personas = withLegacyOwnerFallback(getPersonas) || [];
  const skills = withLegacyOwnerFallback(getSkills) || [];
  const kbDocs = withLegacyOwnerFallback(getKBDocuments) || [];
  const services = getServices() || [];
  const servicePrefs = getServicePreferences(ownerId) || [];
  const activity = getActivityLog(ownerId, { limit: 200, offset: 0 }) || [];

  const files = new Map();
  const addJson = (p, value) => files.set(p, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'));
  const addText = (p, value) => files.set(p, Buffer.from(String(value || ''), 'utf8'));

  const identity = user
    ? {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatarUrl,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      }
    : { id: ownerId };

  addJson('profile/identity.json', identity);
  addText('profile/user.md', readTextFileIfExists(userMdPath) || '');
  addText('profile/soul.md', readTextFileIfExists(soulMdPath) || '');

  const personaList = personas.map((persona) => ({
    id: persona.id,
    name: persona.name,
    description: persona.description,
    createdAt: persona.created_at || persona.createdAt,
    updatedAt: persona.updated_at || persona.updatedAt,
  }));
  addJson('personas/personas.json', personaList);
  personas.forEach((persona) => {
    const config = sanitizePortableObject(persona.config || persona.template_data || null);
    if (config) {
      addJson(`personas/configs/${persona.id}.json`, config);
    }
  });

  const skillsList = skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    author: skill.author,
    category: skill.category,
    repoUrl: skill.repo_url,
    script_content: skill.script_content || '',
    config_json: skill.config_json ? JSON.parse(skill.config_json) : null,
    createdAt: skill.created_at || skill.createdAt,
    updatedAt: skill.updated_at || skill.updatedAt,
  }));
  addJson('skills/skills.json', skillsList);
  skills.forEach((skill) => {
    if (skill.script_content) {
      addText(`skills/scripts/${skill.id}.js`, skill.script_content);
    }
    const config = sanitizePortableObject(skill.config_json || null);
    if (config) {
      addJson(`skills/configs/${skill.id}.json`, config);
    }
  });

  addJson('connectors/services.json', services.map((svc) => ({
    id: svc.id,
    name: svc.name,
    label: svc.label,
    category: svc.category_name || svc.category,
    authType: svc.auth_type,
    active: svc.active,
  })));

  const oauthMetadata = services.map((svc) => {
    const serviceName = svc.name || svc.id;
    let token = null;
    try {
      token = getOAuthToken(serviceName, ownerId);
    } catch {
      token = null;
    }

    const pref = servicePrefs.find((p) => p.service_name === serviceName || p.service_name === svc.id);
    return {
      service: serviceName,
      connected: Boolean(token),
      createdAt: token?.createdAt || null,
      expiresAt: token?.expiresAt || null,
      scope: token?.scope || null,
      preferences: sanitizePortableObject(pref?.preferences || {}),
    };
  });
  addJson('connectors/oauth-metadata.json', oauthMetadata);

  const docsIndex = [];
  for (const doc of kbDocs) {
    const full = getKBDocumentById(doc.id, ownerId) || doc;
    const name = `${String(doc.id)}.md`;
    addText(`knowledge/docs/${name}`, full.content || doc.content || '');

    docsIndex.push({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      createdAt: doc.created_at || doc.createdAt,
      updatedAt: doc.updated_at || doc.updatedAt,
      docPath: `knowledge/docs/${name}`,
      hasFile: false,
    });

    if (includeFiles) {
      const metadata = sanitizePortableObject(full.metadata || doc.metadata || {});
      const candidatePath = metadata.filePath || metadata.path || metadata.originalPath || metadata.storagePath;
      if (candidatePath && fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
        const baseName = path.basename(candidatePath);
        const zippedPath = `knowledge/files/${doc.id}-${baseName}`;
        files.set(zippedPath, fs.readFileSync(candidatePath));
        docsIndex[docsIndex.length - 1].hasFile = true;
        docsIndex[docsIndex.length - 1].filePath = zippedPath;
      }
    }
  }
  addJson('knowledge/index.json', docsIndex);

  const settings = user
    ? {
        privacyPreferences: {
          profilePublic: user.profile_public || false,
          showActivity: user.show_activity || false,
          allowDataExport: user.allow_data_export !== false,
        },
        notifications: {
          emailNotifications: user.email_notifications !== false,
          pushNotifications: user.push_notifications !== false,
        },
        twoFactor: {
          enabled: user.two_factor_enabled || false,
        },
      }
    : {};
  addJson('settings/settings.json', settings);

  const auditSummary = {
    totalEvents: activity.length,
    actionCounts: activity.reduce((acc, row) => {
      const key = row.action_type || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    resourceCounts: activity.reduce((acc, row) => {
      const key = row.resource_type || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    recent: activity.slice(0, 20).map((row) => ({
      createdAt: row.created_at,
      actionType: row.action_type,
      resourceType: row.resource_type,
      result: row.result,
    })),
  };
  addJson('audit/summary.json', auditSummary);

  const manifest = {
    schemaVersion: ZIP_SCHEMA_VERSION,
    exportMode,
    generatedBy: ZIP_GENERATED_BY,
    exportedAt: new Date().toISOString(),
    userId: ownerId,
    workspaceId: workspaceId ? String(workspaceId) : null,
    includeFiles,
    importSupported: false,
    sections: {
      profile: true,
      personas: true,
      skills: true,
      connectors: true,
      knowledge: true,
      settings: true,
      audit: true,
    },
  };
  addJson('manifest.json', manifest);

  const checksumLines = Array.from(files.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([filePath, content]) => `${sha256Buffer(content)}  ${filePath}`);
  addText('checksums.sha256', `${checksumLines.join('\n')}\n`);

  const zip = new JSZip();
  Array.from(files.entries()).forEach(([filePath, content]) => {
    zip.file(filePath, content);
  });

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

/**
 * GET /api/v1/export
 * Exports user data in JSON format based on selected categories
 * Query params:
 *  - mode: portable|forensic (default: portable)
 *  - format: json|zip (default: json)
 *  - includeFiles: boolean (zip only; default false)
 *  - profile: boolean (include USER.md and identity)
 *  - tokens: boolean (include token metadata)
 *  - personas: boolean (include personas and SOUL.md)
 *  - skills: boolean (include skills with scripts and configs)
 *  - knowledge: boolean (include KB documents)
 *  - settings: boolean (include settings)
 */
router.get('/', async (req, res) => {
  try {
    // Support all auth shapes used across the app (session + bearer + route-level userId).
    const userId =
      req.userId ||
      req.user?.id ||
      req.tokenMeta?.ownerId ||
      req.tokenMeta?.userId ||
      req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: No user ID found' });
    }

    const ownerId = String(userId);
    const workspaceId =
      req.workspaceId ||
      req.session?.currentWorkspace ||
      req.headers['x-workspace-id'] ||
      req.query.workspace ||
      null;

    const exportMode = String(req.query.mode || PORTABLE_MODE).toLowerCase() === FORENSIC_MODE
      ? FORENSIC_MODE
      : PORTABLE_MODE;

    const exportFormat = String(req.query.format || 'json').toLowerCase();
    const includeFiles = String(req.query.includeFiles || 'false').toLowerCase() === 'true';

    if (exportFormat === 'zip') {
      const zipBuffer = await buildZipExport({ ownerId, workspaceId, exportMode, includeFiles });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="myapi-export-${exportMode}-${Date.now()}.zip"`);
      return res.send(zipBuffer);
    }

    // Backward-compatibility: older single-user records may still be stored under owner="owner".
    const withLegacyOwnerFallback = (loader) => {
      const primary = loader(ownerId);
      if (ownerId !== 'owner' && (!primary || primary.length === 0)) {
        return loader('owner');
      }
      return primary;
    };

    // Parse requested sections from query params
    const sections = {
      profile: req.query.profile !== 'false',
      tokens: req.query.tokens !== 'false',
      personas: req.query.personas !== 'false',
      skills: req.query.skills !== 'false',
      knowledge: req.query.knowledge !== 'false',
      settings: req.query.settings !== 'false',
    };

    // Validate at least one section is selected
    const hasSelection = Object.values(sections).some(Boolean);
    if (!hasSelection) {
      return res.status(400).json({ error: 'At least one data category must be selected' });
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: EXPORT_SCHEMA_VERSION,
      userId: ownerId,
      workspaceId: workspaceId ? String(workspaceId) : null,
      sections: {},
      manifest: {
        exportMode,
        schemaVersion: EXPORT_SCHEMA_VERSION,
        generatedBy: EXPORT_GENERATED_BY,
        importSupported: false,
        importRationale: 'Full import is intentionally unsupported to prevent unsafe overwrite of account state and security-sensitive references.',
        checksums: {},
      },
    };

    // === PROFILE SECTION ===
    if (sections.profile) {
      try {
        const user = getUserById(ownerId);
        const userMdPath = process.env.USER_MD_PATH || './USER.md';

        const profileData = {};

        // Add basic user info
        if (user) {
          profileData.identity = {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            avatar: user.avatarUrl,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
          };
        }

        // Try to include USER.md content
        if (fs.existsSync(userMdPath)) {
          try {
            profileData.userMdContent = fs.readFileSync(userMdPath, 'utf8');
          } catch (err) {
            profileData.userMdError = `Could not read USER.md: ${err.message}`;
          }
        }

        exportData.sections.profile = profileData;
      } catch (error) {
        exportData.sections.profile = {
          error: `Failed to export profile: ${error.message}`,
        };
      }
    }

    // === TOKENS SECTION ===
    if (sections.tokens) {
      try {
        const tokens = withLegacyOwnerFallback(getAccessTokens) || [];
        const totalTokens = tokens.length;
        const activeTokens = tokens.filter((token) => token.active).length;

        const filtered = exportMode === PORTABLE_MODE
          ? tokens.filter((token) => !isEphemeralTokenLabel(token.label))
          : tokens;

        const ephemeralFiltered = totalTokens - filtered.length;
        const tokenExports = filtered.map((token) => {
          const base = {
            tokenId: exportMode === FORENSIC_MODE ? token.tokenId : maskTokenId(token.tokenId),
            label: token.label,
            scope: token.scope,
            createdAt: token.createdAt,
            expiresAt: token.expiresAt,
            active: token.active,
            allowedPersonas: token.allowedPersonas,
            // Explicitly NOT including the hash/secret for security
          };

          if (exportMode === FORENSIC_MODE) {
            base.ownerId = token.ownerId;
            base.revokedAt = token.revokedAt || null;
          }

          return base;
        });

        exportData.sections.tokens = {
          count: tokenExports.length,
          tokens: tokenExports,
          summary: {
            totalTokens,
            activeTokens,
            ephemeralFiltered,
            exportedTokens: tokenExports.length,
          },
          note: 'Token secrets are never exported for security reasons',
        };
      } catch (error) {
        exportData.sections.tokens = {
          error: `Failed to export tokens: ${error.message}`,
        };
      }
    }

    // === PERSONAS SECTION ===
    if (sections.personas) {
      try {
        const personas = withLegacyOwnerFallback(getPersonas) || [];
        const personaExports = personas.map((persona) => ({
          id: persona.id,
          name: persona.name,
          description: persona.description,
          config: persona.config || persona.template_data || null,
          createdAt: persona.created_at || persona.createdAt,
          updatedAt: persona.updated_at || persona.updatedAt,
        }));

        const soulMdPath = process.env.SOUL_MD_PATH || './SOUL.md';
        let soulMdContent = null;
        if (fs.existsSync(soulMdPath)) {
          try {
            soulMdContent = fs.readFileSync(soulMdPath, 'utf8');
          } catch (_err) {
            // Silently fail if we can't read SOUL.md
          }
        }

        exportData.sections.personas = {
          count: personaExports.length,
          personas: personaExports,
          soulMdContent,
        };
      } catch (error) {
        exportData.sections.personas = {
          error: `Failed to export personas: ${error.message}`,
        };
      }
    }

    // === SKILLS SECTION ===
    if (sections.skills) {
      try {
        const skillsData = withLegacyOwnerFallback(getSkills) || [];
        const skillExports = skillsData.map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          version: skill.version,
          author: skill.author,
          category: skill.category,
          scriptContent: skill.script_content,
          configJson: skill.config_json,
          repoUrl: skill.repo_url,
          createdAt: skill.created_at || skill.createdAt,
          updatedAt: skill.updated_at || skill.updatedAt,
        }));

        exportData.sections.skills = {
          count: skillExports.length,
          skills: skillExports,
        };
      } catch (error) {
        exportData.sections.skills = {
          error: `Failed to export skills: ${error.message}`,
        };
      }
    }

    // === KNOWLEDGE BASE SECTION ===
    if (sections.knowledge) {
      try {
        const documents = withLegacyOwnerFallback(getKBDocuments) || [];
        const docExports = documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          tags: doc.tags,
          createdAt: doc.created_at || doc.createdAt,
          updatedAt: doc.updated_at || doc.updatedAt,
        }));

        exportData.sections.knowledge = {
          count: docExports.length,
          documents: docExports,
        };
      } catch (error) {
        exportData.sections.knowledge = {
          error: `Failed to export knowledge base: ${error.message}`,
        };
      }
    }

    // === SETTINGS SECTION ===
    if (sections.settings) {
      try {
        // Get user settings from the users table
        const user = getUserById(ownerId);
        const settings = {};

        if (user) {
          settings.privacyPreferences = {
            profilePublic: user.profile_public || false,
            showActivity: user.show_activity || false,
            allowDataExport: user.allow_data_export !== false,
          };
          settings.notifications = {
            emailNotifications: user.email_notifications !== false,
            pushNotifications: user.push_notifications !== false,
          };
          settings.twoFactor = {
            enabled: user.two_factor_enabled || false,
          };
        }

        exportData.sections.settings = settings;
      } catch (error) {
        exportData.sections.settings = {
          error: `Failed to export settings: ${error.message}`,
        };
      }
    }

    exportData.manifest.checksums = Object.fromEntries(
      Object.entries(exportData.sections).map(([sectionName, sectionValue]) => [sectionName, checksumFor(sectionValue)])
    );

    // Set appropriate headers for JSON response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="myapi-export-${exportMode}-${Date.now()}.json"`
    );

    return res.json(exportData);
  } catch (error) {
    console.error('Error generating export:', error);
    return res.status(500).json({
      error: 'Failed to generate export',
      message: error.message,
    });
  }
});

module.exports = router;
