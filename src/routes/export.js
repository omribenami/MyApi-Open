const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const {
  getUserById,
  getAccessTokens,
  getPersonas,
  getKBDocuments,
} = require('../database');

const router = express.Router();

const EXPORT_SCHEMA_VERSION = '2.0';
const EXPORT_GENERATED_BY = 'myapi.export.v2';
const PORTABLE_MODE = 'portable';
const FORENSIC_MODE = 'forensic';
const EPHEMERAL_TOKEN_PATTERNS = [/oauth\s*session/i, /dashboard\s*session/i];

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

/**
 * GET /api/v1/export
 * Exports user data in JSON format based on selected categories
 * Query params:
 *  - mode: portable|forensic (default: portable)
 *  - profile: boolean (include USER.md and identity)
 *  - tokens: boolean (include token metadata)
 *  - personas: boolean (include personas and SOUL.md)
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
        const userMdPath = process.env.USER_MD_PATH || '/home/jarvis/.openclaw/workspace/USER.md';

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

        const soulMdPath = process.env.SOUL_MD_PATH || '/home/jarvis/.openclaw/workspace/SOUL.md';
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
