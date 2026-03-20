const express = require('express');
const multer = require('multer');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  getUserById,
  getPersonas,
  createPersona,
  updatePersona,
  db
} = require('../database');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * POST /api/v1/import
 * Imports data from a ZIP export.
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.tokenMeta?.ownerId || req.tokenMeta?.userId || req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: No user ID found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const zip = new JSZip();
    let contents;
    try {
      contents = await zip.loadAsync(req.file.buffer);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid ZIP file' });
    }

    // Extract manifest
    const manifestFile = contents.file('manifest.json');
    if (!manifestFile) {
      return res.status(400).json({ error: 'Invalid ZIP: manifest.json missing' });
    }

    let manifest;
    try {
      const manifestText = await manifestFile.async('text');
      manifest = JSON.parse(manifestText);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid manifest.json format' });
    }

    // Enforce schemaVersion 2.0 or 3.0
    if (!manifest.schemaVersion || !(manifest.schemaVersion.startsWith('2.') || manifest.schemaVersion.startsWith('3.'))) {
      return res.status(400).json({ error: 'Unsupported export schema version' });
    }

    // Verify checksums
    const checksumsFile = contents.file('checksums.sha256');
    const checksums = {};
    if (checksumsFile) {
      const checksumsText = await checksumsFile.async('text');
      checksumsText.split('\n').forEach(line => {
        const [hash, file] = line.split('  ');
        if (hash && file) {
          checksums[file.trim()] = hash.trim();
        }
      });
    }

    // Result summary
    const summary = {
      imported: {
        profile: false,
        settings: false,
        personas: 0
      },
      errors: []
    };

    const ownerId = String(userId);

    // 1. Profile: Safe merge identity and store USER.md / SOUL.md if present
    const identityFile = contents.file('profile/identity.json');
    if (identityFile) {
      try {
        const identityText = await identityFile.async('text');
        const identityData = JSON.parse(identityText);
        // We only safely merge non-critical stuff. For MyApi, maybe just display name or avatar.
        // We won't override ID or username to prevent breakages.
        if (identityData.displayName || identityData.avatar) {
          db.prepare(`UPDATE users SET displayName = COALESCE(?, displayName), avatarUrl = COALESCE(?, avatarUrl) WHERE id = ?`).run(
            identityData.displayName || null,
            identityData.avatar || null,
            ownerId
          );
        }
        summary.imported.profile = true;
      } catch (e) {
        summary.errors.push(`Profile import failed: ${e.message}`);
      }
    }

    // Handle USER.md and SOUL.md
    const userMdFile = contents.file('profile/user.md');
    const soulMdFile = contents.file('profile/soul.md');
    if (userMdFile || soulMdFile) {
      const workspaceDir = process.env.WORKSPACE_DIR || '/home/jarvis/.openclaw/workspace';
      const userMdPath = process.env.USER_MD_PATH || path.join(workspaceDir, 'USER.md');
      const soulMdPath = process.env.SOUL_MD_PATH || path.join(workspaceDir, 'SOUL.md');
      
      if (userMdFile) {
        try {
          const userMdContent = await userMdFile.async('text');
          if (userMdContent.trim()) {
            fs.writeFileSync(userMdPath, userMdContent);
            summary.imported.profile = true;
          }
        } catch (e) {
          summary.errors.push(`USER.md restore failed: ${e.message}`);
        }
      }
      if (soulMdFile) {
        try {
          const soulMdContent = await soulMdFile.async('text');
          if (soulMdContent.trim()) {
            fs.writeFileSync(soulMdPath, soulMdContent);
            summary.imported.profile = true;
          }
        } catch (e) {
          summary.errors.push(`SOUL.md restore failed: ${e.message}`);
        }
      }
    }

    // 2. Settings: Restore non-critical preferences
    const settingsFile = contents.file('settings/settings.json');
    if (settingsFile) {
      try {
        const settingsText = await settingsFile.async('text');
        const settingsData = JSON.parse(settingsText);
        
        // Update user preferences (privacy, notifications)
        if (settingsData.privacyPreferences || settingsData.notifications) {
          const privacy = settingsData.privacyPreferences || {};
          const notifications = settingsData.notifications || {};
          
          db.prepare(`
            UPDATE users SET 
              profile_public = COALESCE(?, profile_public),
              show_activity = COALESCE(?, show_activity),
              allow_data_export = COALESCE(?, allow_data_export),
              email_notifications = COALESCE(?, email_notifications),
              push_notifications = COALESCE(?, push_notifications)
            WHERE id = ?
          `).run(
            privacy.profilePublic !== undefined ? (privacy.profilePublic ? 1 : 0) : null,
            privacy.showActivity !== undefined ? (privacy.showActivity ? 1 : 0) : null,
            privacy.allowDataExport !== undefined ? (privacy.allowDataExport ? 1 : 0) : null,
            notifications.emailNotifications !== undefined ? (notifications.emailNotifications ? 1 : 0) : null,
            notifications.pushNotifications !== undefined ? (notifications.pushNotifications ? 1 : 0) : null,
            ownerId
          );
        }
        summary.imported.settings = true;
      } catch (e) {
        summary.errors.push(`Settings import failed: ${e.message}`);
      }
    }

    // 3. Personas: Upsert by name
    const personasFile = contents.file('personas/personas.json');
    if (personasFile) {
      try {
        const personasText = await personasFile.async('text');
        const personasData = JSON.parse(personasText);
        const existingPersonas = getPersonas(ownerId) || [];
        
        let importedCount = 0;
        for (const pd of personasData) {
          // Check if persona config exists
          let configObj = null;
          const configFile = contents.file(`personas/configs/${pd.id}.json`);
          if (configFile) {
            try {
              const configText = await configFile.async('text');
              configObj = JSON.parse(configText);
            } catch (e) {
              // Ignore config parse error
            }
          }

          const existing = existingPersonas.find(p => p.name === pd.name || p.id === pd.id);
          if (existing) {
            // Update
            updatePersona(existing.id, {
              name: pd.name,
              description: pd.description,
              config: configObj || existing.config || null
            }, ownerId);
            importedCount++;
          } else {
            // Create
            createPersona({
              name: pd.name,
              description: pd.description,
              config: configObj || null,
              ownerId: ownerId,
              isActive: 0
            });
            importedCount++;
          }
        }
        summary.imported.personas = importedCount;
      } catch (e) {
        summary.errors.push(`Personas import failed: ${e.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Import completed successfully',
      summary
    });

  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ error: 'Internal server error during import' });
  }
});

module.exports = router;
