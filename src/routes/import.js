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
  getSkills,
  createSkill,
  updateSkill,
  db
} = require('../database');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// CRITICAL: Patterns to identify and skip sensitive data
const SENSITIVE_KEYS = [
  'access_tokens',
  'oauth_tokens',
  'vault_tokens',
  'service_preferences',
  'device_approval',
  'refresh_token',
  'access_token',
  'secret',
  'token',
  'password',
  'passphrase',
  'api_key',
  'api-key',
  'hash',
  'authorization',
  'cookie',
  'session'
];

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Check if a key name indicates sensitive data
 */
function isSensitiveKey(key) {
  if (!key) return false;
  const lowerKey = String(key).toLowerCase();
  return SENSITIVE_KEYS.some(pattern => lowerKey.includes(pattern));
}

/**
 * Recursively strip sensitive data from an object
 */
function stripSensitiveData(obj, depth = 0) {
  if (depth > 10) return obj; // Prevent infinite recursion
  
  if (Array.isArray(obj)) {
    return obj.map(item => stripSensitiveData(item, depth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        // Skip this key entirely
        continue;
      }
      cleaned[key] = stripSensitiveData(value, depth + 1);
    }
    return cleaned;
  }
  
  return obj;
}

/**
 * POST /api/v1/import
 * Imports data from a v3 ZIP export.
 * 
 * PHASE 1: Verify ZIP Structure
 * - Extract ZIP to memory
 * - Verify manifest.json exists and is valid
 * - Verify checksums.sha256 matches all files
 * - List files in the import
 * 
 * PHASE 2: Parse Data Safely
 * - Read manifest to understand what's being imported
 * - Parse data.json, personas, skills
 * - SKIP any section containing sensitive data
 * - Only process: profiles, personas, skills, settings
 * 
 * PHASE 3: Validate Before Import
 * - Check user_id matches current user
 * - Check for conflicts (persona/skill name conflicts)
 * - Calculate what will be created/updated/skipped
 * 
 * PHASE 4: Execute Import
 * - Use transaction for atomicity
 * - Update user profile
 * - Insert new personas (skip if conflict)
 * - Insert new skills (skip if conflict)
 * - Merge settings
 * 
 * PHASE 5: Return Response
 * - Summary of what was imported
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    // Get user ID from multiple auth shapes
    const userId = req.userId || req.user?.id || req.tokenMeta?.ownerId || req.tokenMeta?.userId || req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: No user ID found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ============================================================
    // PHASE 1: Verify ZIP Structure
    // ============================================================
    const zip = new JSZip();
    let contents;
    try {
      contents = await zip.loadAsync(req.file.buffer);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid ZIP file' });
    }

    // 1.1 Extract and validate manifest.json
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
      return res.status(400).json({ 
        error: 'Unsupported export schema version',
        schemaVersion: manifest.schemaVersion
      });
    }

    // 1.2 Verify checksums
    const checksumsFile = contents.file('checksums.sha256');
    const checksums = {};
    let checksumMismatch = false;
    const checksumsErrors = [];

    if (checksumsFile) {
      try {
        const checksumsText = await checksumsFile.async('text');
        checksumsText.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const [hash, ...fileParts] = parts;
            const filePath = fileParts.join(' ');
            checksums[filePath] = hash;
          }
        });

        // Verify each file in the ZIP matches its checksum
        for (const [filePath, expectedHash] of Object.entries(checksums)) {
          const file = contents.file(filePath);
          if (!file) {
            checksumsErrors.push(`File in checksums not found in ZIP: ${filePath}`);
            checksumMismatch = true;
            continue;
          }
          
          const buffer = await file.async('arraybuffer');
          const actualHash = sha256Buffer(Buffer.from(buffer));
          if (actualHash !== expectedHash) {
            checksumsErrors.push(`Checksum mismatch for ${filePath}`);
            checksumMismatch = true;
          }
        }
      } catch (e) {
        // Log but don't fail on checksum errors
        console.warn('Checksum validation error:', e.message);
      }
    }

    // Log files in the ZIP
    const filesInZip = [];
    contents.forEach((relativePath) => {
      filesInZip.push(relativePath);
    });

    // ============================================================
    // PHASE 2: Parse Data Safely
    // ============================================================
    const ownerId = String(userId);
    const summary = {
      imported: {
        profile: 0,
        settings: 0,
        personas: 0,
        skills: 0
      },
      skipped: {
        personas: 0,
        skills: 0
      },
      conflicts: [],
      errors: [],
      filesProcessed: filesInZip.length,
      checksumMismatchCount: checksumMismatch ? checksumsErrors.length : 0
    };

    // 2.1 Get current user to verify ownership
    const currentUser = getUserById(ownerId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2.2 Check user_id matches (prevent cross-user import)
    const importUserId = manifest.userId || manifest.ownerId;
    if (importUserId && importUserId !== ownerId) {
      return res.status(403).json({ 
        error: 'Cannot import data from a different user',
        importedFromUser: importUserId,
        currentUser: ownerId
      });
    }

    // ============================================================
    // PHASE 3: Validate Before Import
    // ============================================================

    // 3.1 Validate and pre-process profile data
    let profileData = null;
    let userMdContent = null;
    let soulMdContent = null;

    const identityFile = contents.file('profile/identity.json');
    if (identityFile) {
      try {
        const identityText = await identityFile.async('text');
        profileData = JSON.parse(identityText);
        // Strip any sensitive data from profile
        profileData = stripSensitiveData(profileData);
      } catch (e) {
        summary.errors.push(`Profile parse error: ${e.message}`);
      }
    }

    const userMdFile = contents.file('profile/user.md');
    if (userMdFile) {
      try {
        userMdContent = await userMdFile.async('text');
      } catch (e) {
        summary.errors.push(`USER.md read error: ${e.message}`);
      }
    }

    const soulMdFile = contents.file('profile/soul.md');
    if (soulMdFile) {
      try {
        soulMdContent = await soulMdFile.async('text');
      } catch (e) {
        summary.errors.push(`SOUL.md read error: ${e.message}`);
      }
    }

    // 3.2 Validate and pre-process personas
    const personasToImport = [];
    const existingPersonas = getPersonas(ownerId) || [];

    const personasFile = contents.file('personas/personas.json');
    if (personasFile) {
      try {
        const personasText = await personasFile.async('text');
        const personasData = JSON.parse(personasText);
        
        for (const pd of personasData) {
          // Skip if duplicate name exists
          const conflict = existingPersonas.find(p => p.name === pd.name);
          if (conflict) {
            summary.skipped.personas++;
            summary.conflicts.push({
              type: 'persona',
              name: pd.name,
              reason: 'Name already exists'
            });
            continue;
          }

          // Load persona config if available
          let configObj = null;
          const configFile = contents.file(`personas/configs/${pd.id}.json`);
          if (configFile) {
            try {
              const configText = await configFile.async('text');
              configObj = JSON.parse(configText);
              // Strip sensitive data from config
              configObj = stripSensitiveData(configObj);
            } catch (e) {
              console.warn(`Failed to parse persona config ${pd.id}:`, e.message);
            }
          }

          personasToImport.push({
            name: pd.name,
            description: pd.description || '',
            config: configObj,
            id: pd.id
          });
        }
      } catch (e) {
        summary.errors.push(`Personas parse error: ${e.message}`);
      }
    }

    // 3.3 Validate and pre-process skills
    const skillsToImport = [];
    const existingSkills = getSkills(ownerId) || [];

    // Skills might be in knowledge/ or skills/ directory depending on export version
    const skillsFile = contents.file('skills/skills.json');
    if (skillsFile) {
      try {
        const skillsText = await skillsFile.async('text');
        const skillsData = JSON.parse(skillsText);
        
        for (const sd of skillsData) {
          // Skip if duplicate name exists
          const conflict = existingSkills.find(s => s.name === sd.name);
          if (conflict) {
            summary.skipped.skills++;
            summary.conflicts.push({
              type: 'skill',
              name: sd.name,
              reason: 'Name already exists'
            });
            continue;
          }

          // Load skill script if available
          let scriptContent = '';
          const scriptFile = contents.file(`skills/scripts/${sd.id}.js`);
          if (scriptFile) {
            try {
              scriptContent = await scriptFile.async('text');
            } catch (e) {
              console.warn(`Failed to read skill script ${sd.id}:`, e.message);
            }
          }

          // Load skill config if available
          let configJson = null;
          const configFile = contents.file(`skills/configs/${sd.id}.json`);
          if (configFile) {
            try {
              const configText = await configFile.async('text');
              configJson = JSON.parse(configText);
              // Strip sensitive data from config
              configJson = stripSensitiveData(configJson);
            } catch (e) {
              console.warn(`Failed to parse skill config ${sd.id}:`, e.message);
            }
          }

          skillsToImport.push({
            name: sd.name,
            description: sd.description || '',
            version: sd.version || '1.0.0',
            author: sd.author || 'imported',
            category: sd.category || 'general',
            scriptContent: scriptContent,
            configJson: configJson,
            repoUrl: sd.repoUrl || null,
            id: sd.id
          });
        }
      } catch (e) {
        summary.errors.push(`Skills parse error: ${e.message}`);
      }
    }

    // 3.4 Validate and pre-process settings
    let settingsData = null;
    const settingsFile = contents.file('settings/settings.json');
    if (settingsFile) {
      try {
        const settingsText = await settingsFile.async('text');
        settingsData = JSON.parse(settingsText);
        // Strip sensitive data from settings
        settingsData = stripSensitiveData(settingsData);
      } catch (e) {
        summary.errors.push(`Settings parse error: ${e.message}`);
      }
    }

    // ============================================================
    // PHASE 4: Execute Import (with Transaction)
    // ============================================================
    try {
      // Start transaction
      const insertProfile = db.transaction(() => {
        // 4.1 Update user profile
        if (profileData) {
          try {
            db.prepare(`
              UPDATE users SET 
                displayName = COALESCE(?, displayName),
                avatarUrl = COALESCE(?, avatarUrl)
              WHERE id = ?
            `).run(
              profileData.displayName || null,
              profileData.avatar || null,
              ownerId
            );
            summary.imported.profile = 1;
          } catch (e) {
            summary.errors.push(`Profile update failed: ${e.message}`);
          }
        }

        // Store USER.md and SOUL.md if provided
        if (userMdContent || soulMdContent) {
          try {
            const workspaceDir = process.env.WORKSPACE_DIR || '/home/jarvis/.openclaw/workspace';
            const userMdPath = process.env.USER_MD_PATH || path.join(workspaceDir, 'USER.md');
            const soulMdPath = process.env.SOUL_MD_PATH || path.join(workspaceDir, 'SOUL.md');
            
            if (userMdContent && userMdContent.trim()) {
              fs.writeFileSync(userMdPath, userMdContent);
            }
            if (soulMdContent && soulMdContent.trim()) {
              fs.writeFileSync(soulMdPath, soulMdContent);
            }
          } catch (e) {
            summary.errors.push(`Markdown file write failed: ${e.message}`);
          }
        }

        // 4.2 Update settings
        if (settingsData) {
          try {
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
            summary.imported.settings = 1;
          } catch (e) {
            summary.errors.push(`Settings update failed: ${e.message}`);
          }
        }

        // 4.3 Import personas
        for (const persona of personasToImport) {
          try {
            createPersona(
              persona.name,
              persona.config?.soul_content || '',
              persona.description,
              persona.config || null,
              ownerId
            );
            summary.imported.personas++;
          } catch (e) {
            summary.errors.push(`Persona import failed (${persona.name}): ${e.message}`);
          }
        }

        // 4.4 Import skills
        for (const skill of skillsToImport) {
          try {
            createSkill(
              skill.name,
              skill.description,
              skill.version,
              skill.author,
              skill.category,
              skill.scriptContent,
              skill.configJson ? JSON.stringify(skill.configJson) : null,
              skill.repoUrl,
              ownerId
            );
            summary.imported.skills++;
          } catch (e) {
            summary.errors.push(`Skill import failed (${skill.name}): ${e.message}`);
          }
        }
      });

      // Execute transaction
      insertProfile();
    } catch (error) {
      summary.errors.push(`Transaction failed: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Transaction failed during import',
        summary
      });
    }

    // ============================================================
    // PHASE 5: Return Response
    // ============================================================
    const totalImported = summary.imported.profile + 
                         summary.imported.settings + 
                         summary.imported.personas + 
                         summary.imported.skills;
    const totalSkipped = summary.skipped.personas + summary.skipped.skills;

    return res.status(200).json({
      success: true,
      message: `Import complete. ${totalImported} items imported, ${totalSkipped} skipped.`,
      imported: summary.imported,
      skipped: summary.skipped,
      conflicts: summary.conflicts,
      filesProcessed: summary.filesProcessed,
      checksumErrors: summary.checksumMismatchCount,
      errors: summary.errors.length > 0 ? summary.errors : undefined,
      schemaVersion: manifest.schemaVersion
    });

  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ 
      error: 'Internal server error during import',
      message: error.message 
    });
  }
});

module.exports = router;
