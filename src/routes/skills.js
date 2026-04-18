const logger = require('../utils/logger');
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const GitHubRepoMetadata = require('../services/github-repo-metadata');
const NotificationDispatcher = require('../lib/notificationDispatcher');
const { isResourceAllowed } = require('../middleware/scope-validator');

// Where Claude Code skills live when mounted into the container
const CLAUDE_SKILLS_DIR = process.env.CLAUDE_SKILLS_DIR || '/app/claude-skills';

function createSkillsRoutes(
  db,
  createSkill,
  getSkills,
  getSkillById,
  getSkillBySlug,
  getSkillsByIds,
  getSkillsBySlugList,
  suggestSkills,
  updateSkill,
  deleteSkill,
  updateSkillOrigin,
  createSkillVersion,
  getSkillVersions,
  getSkillVersion,
  createSkillFork,
  getSkillForks,
  getSkillForkInfo,
  getLicenses,
  getLicense,
  validateLicenseOperation,
  createOwnershipClaim,
  getOwnershipClaim,
  verifyOwnershipClaim,
  getSkillOwnershipClaims
) {
  const router = express.Router();

  // Helper to extract owner from token
  const getOwnerId = (req) => req.tokenMeta?.ownerId || req.tokenData?.id || req.session?.user?.id || req.session?.userId || 'owner';

  const isMasterToken = (req) => {
    const meta = req.tokenMeta;
    if (!meta) return !!req.session?.user;
    return meta.scope === 'full' || meta.tokenType === 'master' || String(meta.tokenId || '').startsWith('sess_');
  };

  const getScopeList = (req) => {
    const meta = req.tokenMeta;
    if (!meta) return [];
    const scopeStr = meta.scope || '';
    try { return JSON.parse(scopeStr); } catch { return scopeStr.split(',').map(s => s.trim()); }
  };

  // Check if request has read permission (master, skills:read, or skills:write scope)
  const canReadSkills = (req) => {
    if (isMasterToken(req)) return true;
    const scopes = getScopeList(req);
    return scopes.includes('admin:*') || scopes.includes('skills:read') || scopes.includes('skills:write');
  };

  // Check if request has write permission (master token or skills:write scope)
  const canWriteSkills = (req) => {
    if (isMasterToken(req)) return true;
    const scopes = getScopeList(req);
    return scopes.includes('admin:*') || scopes.includes('skills:write');
  };

  // Return the persona_id from scope_bundle if this is a non-master bundle token
  const getBundlePersonaId = (req) => {
    if (isMasterToken(req)) return null;
    const bundle = req.tokenMeta?.scopeBundle;
    if (!bundle) return null;
    try {
      const parsed = typeof bundle === 'string' ? JSON.parse(bundle) : bundle;
      return parsed?.persona_id ? Number(parsed.persona_id) : null;
    } catch { return null; }
  };

  // Validation error handler
  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };

  // Sanitize YAML frontmatter in skill script_content to prevent parse errors in AI tools.
  // Strips control chars, escapes problematic YAML punctuation in description lines,
  // and replaces common arrow unicode with ASCII equivalents.
  const sanitizeFrontmatter = (content) => {
    if (!content || typeof content !== 'string') return content;
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return content;
    const sanitizedFm = fmMatch[1]
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/→/g, '->')
      .replace(/←/g, '<-')
      .replace(/^\s*(description|summary|name|title)\s*:\s*(.+)$/gm, (_, key, val) => {
        // Wrap values containing unquoted colons or special chars in double-quotes
        const trimmed = val.trim();
        if ((trimmed.includes(':') || trimmed.includes('"') || trimmed.includes("'") || trimmed.includes('#')) && !trimmed.startsWith('"') && !trimmed.startsWith("'")) {
          const escaped = trimmed.replace(/"/g, '\\"');
          return `${key}: "${escaped}"`;
        }
        return `${key}: ${trimmed}`;
      });
    return content.replace(fmMatch[0], `---\n${sanitizedFm}\n---`);
  };

  const enrichSkill = (skill) => ({
    ...skill,
    slug: skill.name,
    origin: {
      type: skill.origin_type || 'local',
      sourceId: skill.origin_source_id,
      owner: skill.origin_owner,
      ownerType: skill.origin_owner_type,
      isFork: Boolean(skill.is_fork),
      upstreamOwner: skill.upstream_owner,
      upstreamRepoUrl: skill.upstream_repo_url,
      license: skill.license || 'Proprietary',
      publishedAt: skill.published_at
    },
    isFork: Boolean(skill.is_fork)
  });

  // GET /skills - List skills with optional filtering
  // Query params: slug, category, q (search), limit
  router.get('/', [
    query('include_archived').optional().isBoolean(),
    query('slug').optional().isString().trim(),
    query('category').optional().isString().trim(),
    query('q').optional().isString().trim(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt()
  ], handleValidationErrors, (req, res) => {
    if (!canReadSkills(req)) return res.status(403).json({ error: "Requires 'skills:read' scope" });
    try {
      const ownerId = getOwnerId(req);
      const filters = {
        slug: req.query.slug,
        category: req.query.category,
        q: req.query.q,
        limit: req.query.limit
      };
      let skills = getSkills(ownerId, null, filters);

      // Bundle token: restrict to skills attached to the bundled persona only
      const bundlePersonaId = getBundlePersonaId(req);
      if (bundlePersonaId) {
        const attached = db.prepare('SELECT skill_id FROM persona_skills WHERE persona_id = ?').all(bundlePersonaId);
        const allowedIds = new Set(attached.map(r => Number(r.skill_id)));
        skills = skills.filter(s => allowedIds.has(Number(s.id)));
      }

      // Per-resource allow-list filter.
      skills = skills.filter((s) => isResourceAllowed(req, 'skills', s.id));

      const result = { skills: skills.map(enrichSkill) };
      if (result.skills.length === 0) {
        result._discovery = {
          hint: 'No skills matched. Try broader filters or fetch all skills without query params.',
          endpoints: {
            listAll: 'GET /api/v1/skills',
            suggestions: 'GET /api/v1/skills/suggestions?q=<term>',
            bySlug: 'GET /api/v1/skills/_by_slug/<name>',
            docs: '/openapi.json'
          }
        };
      }
      res.json(result);
    } catch (error) {
      logger.error('Error listing skills:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /skills/suggestions - Fuzzy skill name/description suggestions for AI discovery
  router.get('/suggestions', [
    query('q').isString().trim().notEmpty()
  ], handleValidationErrors, (req, res) => {
    if (!canReadSkills(req)) return res.status(403).json({ error: "Requires 'skills:read' scope" });
    try {
      const ownerId = getOwnerId(req);
      const results = suggestSkills(req.query.q, ownerId, 10);
      const response = {
        suggestions: results.map(s => ({
          id: s.id,
          slug: s.name,
          name: s.name,
          description: s.description,
          category: s.category
        }))
      };
      if (response.suggestions.length === 0) {
        response._discovery = {
          hint: 'No skills matched your query. List all skills to browse available options.',
          listAll: 'GET /api/v1/skills'
        };
      }
      res.json(response);
    } catch (error) {
      logger.error('Error fetching skill suggestions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /skills/_by_slug/:slug - Retrieve a skill by its name/slug (faster for AI agents)
  router.get('/_by_slug/:slug', (req, res) => {
    if (!canReadSkills(req)) return res.status(403).json({ error: "Requires 'skills:read' scope" });
    try {
      const ownerId = getOwnerId(req);
      const skill = getSkillBySlug(req.params.slug, ownerId);
      if (!skill) return res.status(404).json({ error: 'Skill not found' });

      const bundlePersonaId = getBundlePersonaId(req);
      if (bundlePersonaId) {
        const attached = db.prepare('SELECT skill_id FROM persona_skills WHERE persona_id = ? AND skill_id = ?').get(bundlePersonaId, skill.id);
        if (!attached) return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      if (!isResourceAllowed(req, 'skills', skill.id)) {
        return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      res.json({ skill: enrichSkill(skill) });
    } catch (error) {
      logger.error('Error fetching skill by slug:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /skills/_batch - Fetch multiple skills by id or slug in one request
  // Query params: id (repeatable), slug (repeatable)
  router.get('/_batch', (req, res) => {
    if (!canReadSkills(req)) return res.status(403).json({ error: "Requires 'skills:read' scope" });
    try {
      const ownerId = getOwnerId(req);
      const ids = [].concat(req.query.id || []).filter(Boolean).slice(0, 50);
      const slugs = [].concat(req.query.slug || []).filter(Boolean).slice(0, 50);

      if (ids.length === 0 && slugs.length === 0) {
        return res.status(400).json({ error: 'Provide at least one id or slug query param' });
      }

      let byId = ids.length ? getSkillsByIds(ids, ownerId) : [];
      let bySlug = slugs.length ? getSkillsBySlugList(slugs, ownerId) : [];

      // Deduplicate by id
      const seen = new Set();
      const combined = [...byId, ...bySlug].filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      const bundlePersonaId = getBundlePersonaId(req);
      const allowed = bundlePersonaId
        ? new Set(db.prepare('SELECT skill_id FROM persona_skills WHERE persona_id = ?').all(bundlePersonaId).map(r => Number(r.skill_id)))
        : null;

      const skills = combined
        .filter(s => !allowed || allowed.has(Number(s.id)))
        .filter(s => isResourceAllowed(req, 'skills', s.id))
        .map(enrichSkill);

      res.json({ skills });
    } catch (error) {
      logger.error('Error fetching skill batch:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /skills/:id - Get skill details
  router.get('/:id', (req, res) => {
    if (!canReadSkills(req)) return res.status(403).json({ error: "Requires 'skills:read' scope" });
    try {
      const ownerId = getOwnerId(req);
      const skill = getSkillById(req.params.id, ownerId);

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      // Bundle token: block access to skills not attached to the bundled persona
      const bundlePersonaId = getBundlePersonaId(req);
      if (bundlePersonaId) {
        const attached = db.prepare('SELECT skill_id FROM persona_skills WHERE persona_id = ? AND skill_id = ?').get(bundlePersonaId, skill.id);
        if (!attached) return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      if (!isResourceAllowed(req, 'skills', skill.id)) {
        return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      // Get fork info if it's a fork
      const forkInfo = skill.is_fork ? getSkillForkInfo(skill.id) : null;

      // Get versions
      const versions = getSkillVersions(skill.id, ownerId);

      // Get ownership claims
      const ownershipClaims = getSkillOwnershipClaims(skill.id, ownerId);

      res.json({
        skill: {
          ...enrichSkill(skill),
          versions,
          forkInfo,
          ownershipClaims
        }
      });
    } catch (error) {
      logger.error('Error getting skill:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /skills/:id/content - Get raw skill content (SKILL.md text) as JSON or plain text
  // Accepts: application/json (default) or text/plain / text/markdown
  router.get('/:id/content', (req, res) => {
    if (!canReadSkills(req)) return res.status(403).json({ error: "Requires 'skills:read' scope" });
    try {
      const ownerId = getOwnerId(req);
      const skill = getSkillById(req.params.id, ownerId);
      if (!skill) return res.status(404).json({ error: 'Skill not found' });

      const bundlePersonaId = getBundlePersonaId(req);
      if (bundlePersonaId) {
        const attached = db.prepare('SELECT skill_id FROM persona_skills WHERE persona_id = ? AND skill_id = ?').get(bundlePersonaId, skill.id);
        if (!attached) return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      if (!isResourceAllowed(req, 'skills', skill.id)) {
        return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      let content = skill.script_content || '';
      if (!content) {
        const diskPath = path.join(CLAUDE_SKILLS_DIR, skill.name, 'SKILL.md');
        try { content = fs.readFileSync(diskPath, 'utf8'); } catch (_) { content = ''; }
      }

      const accept = req.headers.accept || '';
      if (accept.includes('text/')) {
        res.set('Content-Type', 'text/markdown; charset=utf-8');
        return res.send(content);
      }

      res.json({
        id: skill.id,
        slug: skill.name,
        name: skill.name,
        content,
        contentType: 'text/markdown'
      });
    } catch (error) {
      logger.error('Error getting skill content:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /skills - Create skill with origin
  router.post('/', [
    body('name').isString().trim().notEmpty(),
    body('description').optional().isString().trim(),
    body('category').optional().isString().trim(),
    body('scriptContent').optional().isString(),
    body('configJson').optional().isObject(),
    body('repoUrl').optional().isString().trim(),
    body('originType').optional().isIn(['github', 'marketplace', 'local']),
    body('originOwner').optional().isString().trim(),
    body('license').optional().isString().trim()
  ], handleValidationErrors, async (req, res) => {
    if (!canWriteSkills(req)) return res.status(403).json({ error: "Requires 'skills:write' scope" });
    try {
      const ownerId = getOwnerId(req);
      const {
        name,
        description,
        category,
        scriptContent,
        configJson,
        repoUrl,
        originType,
        originOwner,
        license,
        githubUsername
      } = req.body;

      // Sanitize name and description to prevent prompt injection when used in LLM prompts
      const sanitizeSkillText = (s, maxLen) => {
        if (!s || typeof s !== 'string') return s;
        return s
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions?/gi, '')
          .slice(0, maxLen);
      };

      // If GitHub URL provided, fetch metadata
      let skillData = {
        name: sanitizeSkillText(name, 100),
        description: sanitizeSkillText(description, 1000),
        category,
        scriptContent,
        configJson,
        repoUrl,
        originType: originType || 'local',
        originOwner,
        license: license || 'Proprietary'
      };

      if (repoUrl && originType === 'github') {
        try {
          const github = new GitHubRepoMetadata();
          const parsed = GitHubRepoMetadata.parseGitHubUrl(repoUrl);
          
          if (parsed) {
            const metadata = await github.getRepoMetadata(parsed.owner, parsed.repo);
            
            if (!metadata.error) {
              skillData.originOwner = metadata.owner;
              skillData.isFork = metadata.isFork;
              
              if (metadata.isFork) {
                skillData.upstreamOwner = metadata.parentOwner;
                skillData.upstreamRepoUrl = `https://github.com/${metadata.parentOwner}/${metadata.parentName}`;
              }

              // Try to detect license from GitHub
              if (metadata.license) {
                const licenseName = mapGitHubLicense(metadata.license);
                if (licenseName) {
                  skillData.license = licenseName;
                }
              }
            }
          }
        } catch (error) {
          logger.warn('Failed to fetch GitHub metadata:', error.message);
        }
      }

      // Sanitize YAML frontmatter in scriptContent before saving
      if (skillData.scriptContent) {
        skillData.scriptContent = sanitizeFrontmatter(skillData.scriptContent);
      }

      // Create the skill
      const skill = createSkill(
        skillData.name,
        skillData.description,
        '1.0.0',
        skillData.originOwner || githubUsername,
        skillData.category || 'custom',
        skillData.scriptContent,
        skillData.configJson,
        skillData.repoUrl,
        ownerId
      );

      // Update with origin info
      updateSkillOrigin(skill.id, {
        origin_type: skillData.originType,
        origin_owner: skillData.originOwner,
        origin_owner_type: skillData.originType === 'github' ? 'github_user' : 'myapi_user',
        is_fork: skillData.isFork ? 1 : 0,
        upstream_owner: skillData.upstreamOwner,
        upstream_repo_url: skillData.upstreamRepoUrl,
        license: skillData.license
      }, ownerId);

      // Create ownership claim if GitHub username provided
      if (githubUsername) {
        createOwnershipClaim(skill.id, ownerId, githubUsername, null, ownerId);
      }

      const updatedSkill = getSkillById(skill.id, ownerId);

      // Notify user of new skill
      const skillCreateWs = db.prepare('SELECT id FROM workspaces WHERE owner_id = ? LIMIT 1').get(ownerId);
      if (skillCreateWs) {
        NotificationDispatcher.onSkillInstalled(skillCreateWs.id, ownerId, skillData.name, skill.id)
          .catch(() => {});
      }

      res.status(201).json({
        skill: {
          ...updatedSkill,
          origin: {
            type: updatedSkill.origin_type,
            sourceId: updatedSkill.origin_source_id,
            owner: updatedSkill.origin_owner,
            ownerType: updatedSkill.origin_owner_type,
            isFork: Boolean(updatedSkill.is_fork),
            upstreamOwner: updatedSkill.upstream_owner,
            upstreamRepoUrl: updatedSkill.upstream_repo_url,
            license: updatedSkill.license,
            publishedAt: updatedSkill.published_at
          }
        }
      });
    } catch (error) {
      logger.error('Error creating skill:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /skills/:id/versions - Create a new version
  router.post('/:id/versions', [
    body('releaseNotes').optional().isString()
  ], handleValidationErrors, (req, res) => {
    if (!canWriteSkills(req)) return res.status(403).json({ error: "Requires 'skills:write' scope" });
    try {
      const ownerId = getOwnerId(req);
      const skill = getSkillById(req.params.id, ownerId);

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      if (!isResourceAllowed(req, 'skills', skill.id)) {
        return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      const { releaseNotes } = req.body;
      
      // Calculate content hash
      const content = skill.script_content || '';
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');

      // Parse version number
      const [major, minor, patch] = (skill.version || '1.0.0').split('.').map(Number);
      const newVersion = `${major}.${minor}.${patch + 1}`;

      const version = createSkillVersion(
        skill.id,
        newVersion,
        contentHash,
        ownerId,
        releaseNotes,
        skill.script_content,
        skill.config_json,
        ownerId
      );

      res.status(201).json({ version });
    } catch (error) {
      logger.error('Error creating skill version:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /skills/:id/versions - Get skill versions
  router.get('/:id/versions', (req, res) => {
    try {
      const ownerId = getOwnerId(req);
      const skill = getSkillById(req.params.id, ownerId);

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      const versions = getSkillVersions(skill.id, ownerId);

      res.json({ versions });
    } catch (error) {
      logger.error('Error getting skill versions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /skills/:id/forks - Get skill forks
  router.get('/:id/forks', (req, res) => {
    try {
      const forks = getSkillForks(req.params.id);
      res.json({ forks });
    } catch (error) {
      logger.error('Error getting skill forks:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /skills/:id/fork - Create a fork of a skill
  router.post('/:id/fork', [
    body('name').isString().trim().notEmpty(),
    body('description').optional().isString().trim()
  ], handleValidationErrors, (req, res) => {
    if (!canWriteSkills(req)) return res.status(403).json({ error: "Requires 'skills:write' scope" });
    try {
      const ownerId = getOwnerId(req);
      const { name, description } = req.body;

      // Get the original skill (might be owned by someone else)
      // For now, we'll assume we can access public skills
      const stmt = db.prepare('SELECT * FROM skills WHERE id = ?');
      const originalSkill = stmt.get(req.params.id);

      if (!originalSkill) {
        return res.status(404).json({ error: 'Original skill not found' });
      }

      if (!isResourceAllowed(req, 'skills', originalSkill.id)) {
        return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      // Check license allows forking
      const license = getLicense(originalSkill.license || 'Proprietary');
      if (license && !license.canFork) {
        return res.status(403).json({
          error: 'License does not allow forking',
          license: originalSkill.license
        });
      }

      // Create fork skill
      const forkedSkill = createSkill(
        name || `${originalSkill.name} (fork)`,
        description || originalSkill.description,
        originalSkill.version,
        originalSkill.author,
        originalSkill.category,
        originalSkill.script_content,
        originalSkill.config_json,
        originalSkill.repo_url,
        ownerId
      );

      // Create fork relationship
      createSkillFork(originalSkill.id, forkedSkill.id, ownerId, ownerId);

      const updatedSkill = getSkillById(forkedSkill.id, ownerId);

      res.status(201).json({
        skill: {
          ...updatedSkill,
          origin: {
            type: 'local',
            sourceId: null,
            owner: ownerId,
            ownerType: 'myapi_user',
            isFork: true,
            upstreamOwner: originalSkill.origin_owner || originalSkill.author,
            upstreamRepoUrl: originalSkill.repo_url,
            license: originalSkill.license,
            publishedAt: null
          }
        }
      });
    } catch (error) {
      logger.error('Error forking skill:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /skills/:id/skill.md - Get the SKILL.md content as raw text
  router.get('/:id/skill.md', (req, res) => {
    if (!canReadSkills(req)) return res.status(403).json({ error: "Requires 'skills:read' scope" });
    try {
      const ownerId = getOwnerId(req);
      const skill = getSkillById(req.params.id, ownerId);

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      // Bundle token: block access to skills not attached to the bundled persona
      const bundlePersonaId = getBundlePersonaId(req);
      if (bundlePersonaId) {
        const attached = db.prepare('SELECT skill_id FROM persona_skills WHERE persona_id = ? AND skill_id = ?').get(bundlePersonaId, skill.id);
        if (!attached) return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      if (!isResourceAllowed(req, 'skills', skill.id)) {
        return res.status(403).json({ error: 'Skill not accessible with this token' });
      }

      let content = skill.script_content || null;

      // Fall back to SKILL.md on disk (mounted from the host Claude skills dir)
      if (!content) {
        const diskPath = path.join(CLAUDE_SKILLS_DIR, skill.name, 'SKILL.md');
        try {
          content = fs.readFileSync(diskPath, 'utf8');
        } catch (_) {
          content = '';
        }
      }

      res.set('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    } catch (error) {
      logger.error('Error getting skill.md:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /skills/:id/skill.md - Set the SKILL.md content
  // Accepts:
  //   - JSON body: { "content": "# My Skill\n..." }  (Content-Type: application/json)
  //   - Raw markdown body                             (Content-Type: text/markdown or text/plain)
  router.put(
    '/:id/skill.md',
    (req, res, next) => {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('text/')) {
        express.text({ type: 'text/*', limit: '500kb' })(req, res, next);
      } else {
        next();
      }
    },
    (req, res) => {
      if (!canWriteSkills(req)) return res.status(403).json({ error: "Requires 'skills:write' scope" });
      try {
        const ownerId = getOwnerId(req);
        const skill = getSkillById(req.params.id, ownerId);

        if (!skill) {
          return res.status(404).json({ error: 'Skill not found' });
        }

        if (!isResourceAllowed(req, 'skills', skill.id)) {
          return res.status(403).json({ error: 'Skill not accessible with this token' });
        }

        // Resolve content from either raw text or JSON body
        const ct = req.headers['content-type'] || '';
        let content;
        if (ct.includes('text/')) {
          content = typeof req.body === 'string' ? req.body : '';
        } else {
          content = req.body?.content ?? req.body?.script_content ?? '';
        }

        const sanitized = sanitizeFrontmatter(String(content));
        const updated = updateSkill(skill.id, { script_content: sanitized }, ownerId);
        res.json({ ok: true, skill: updated });
      } catch (error) {
        logger.error('Error updating skill.md:', error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // GET /licenses - Get available licenses
  router.get('/licenses', (req, res) => {
    try {
      const licenses = getLicenses();
      res.json({ licenses });
    } catch (error) {
      logger.error('Error getting licenses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /skills/:id/verify-ownership - Create ownership claim
  router.post('/:id/verify-ownership', [
    body('githubUsername').optional().isString().trim(),
    body('marketplaceUserId').optional().isString().trim()
  ], handleValidationErrors, (req, res) => {
    try {
      const ownerId = getOwnerId(req);
      const { githubUsername, marketplaceUserId } = req.body;

      const skill = getSkillById(req.params.id, ownerId);
      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      const claim = createOwnershipClaim(
        skill.id,
        ownerId,
        githubUsername,
        marketplaceUserId,
        ownerId
      );

      res.status(201).json({ claim });
    } catch (error) {
      logger.error('Error creating ownership claim:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /skills/:id/verify-ownership/:claimId - Verify ownership
  router.post('/:id/verify-ownership/:claimId', async (req, res) => {
    try {
      const ownerId = getOwnerId(req);
      const skill = getSkillById(req.params.id, ownerId);

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      const claim = getOwnershipClaim(skill.id, ownerId, ownerId);
      if (!claim) {
        return res.status(404).json({ error: 'Ownership claim not found' });
      }

      // If GitHub username, verify against repo
      if (claim.githubUsername && skill.repo_url) {
        const github = new GitHubRepoMetadata();
        const parsed = GitHubRepoMetadata.parseGitHubUrl(skill.repo_url);

        if (parsed && parsed.owner === claim.githubUsername) {
          verifyOwnershipClaim(skill.id, ownerId, ownerId);
          const verified = getOwnershipClaim(skill.id, ownerId, ownerId);
          return res.json({ claim: verified, verified: true });
        }

        return res.status(403).json({
          error: 'GitHub username does not match repository owner',
          expected: parsed.owner,
          provided: claim.githubUsername
        });
      }

      // For other verification methods, mark as verified
      verifyOwnershipClaim(skill.id, ownerId, ownerId);
      const verified = getOwnershipClaim(skill.id, ownerId, ownerId);

      res.json({ claim: verified, verified: true });
    } catch (error) {
      logger.error('Error verifying ownership:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

/**
 * Map GitHub license SPDX ID to MyApi license
 */
function mapGitHubLicense(spdxId) {
  const mapping = {
    'MIT': 'MIT',
    'Apache-2.0': 'Apache 2.0',
    'GPL-3.0': 'GPL',
    'GPL-2.0': 'GPL',
    'AGPL-3.0': 'GPL'
  };

  return mapping[spdxId] || null;
}

module.exports = createSkillsRoutes;
