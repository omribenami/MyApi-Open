const { getDatabase } = require('../config/database');
const Encryption = require('../utils/encryption');
const fs = require('fs');
const logger = require('../utils/logger');

class Vault {
  constructor(encryptionKey) {
    this.encryption = new Encryption(encryptionKey);
    this.db = getDatabase();
  }

  // Store identity data (encrypted at rest)
  storeIdentity(key, value, category = 'general', metadata = null) {
    const encrypted = this.encryption.encrypt(value);
    const timestamp = Date.now();
    
    const stmt = this.db.prepare(`
      INSERT INTO identity_vault (key, value_encrypted, category, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_encrypted = excluded.value_encrypted,
        updated_at = excluded.updated_at,
        metadata = excluded.metadata
    `);
    
    stmt.run(key, encrypted, category, timestamp, metadata ? JSON.stringify(metadata) : null);
    logger.info('Vault: Stored identity data', { key, category });
  }

  // Retrieve identity data (decrypted)
  getIdentity(key) {
    const stmt = this.db.prepare('SELECT value_encrypted, category, metadata FROM identity_vault WHERE key = ?');
    const row = stmt.get(key);
    
    if (!row) return null;
    
    return {
      value: this.encryption.decryptJSON(row.value_encrypted),
      category: row.category,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  }

  // Get all identity data by category
  getIdentityByCategory(category) {
    const stmt = this.db.prepare('SELECT key, value_encrypted, metadata FROM identity_vault WHERE category = ?');
    const rows = stmt.all(category);
    
    return rows.map(row => ({
      key: row.key,
      value: this.encryption.decryptJSON(row.value_encrypted),
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  }

  // Get all identity keys (for discovery)
  getAllIdentityKeys() {
    const stmt = this.db.prepare('SELECT key, category FROM identity_vault');
    return stmt.all();
  }

  // Store preference
  storePreference(key, value, category = 'general') {
    const timestamp = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO preferences (key, value, category, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);
    
    stmt.run(key, JSON.stringify(value), category, timestamp);
    logger.info('Vault: Stored preference', { key, category });
  }

  // Get preference
  getPreference(key) {
    const stmt = this.db.prepare('SELECT value, category FROM preferences WHERE key = ?');
    const row = stmt.get(key);
    
    if (!row) return null;
    
    return {
      value: JSON.parse(row.value),
      category: row.category
    };
  }

  // Get all preferences by category
  getPreferencesByCategory(category) {
    const stmt = this.db.prepare('SELECT key, value FROM preferences WHERE category = ?');
    const rows = stmt.all(category);
    
    return rows.reduce((acc, row) => {
      acc[row.key] = JSON.parse(row.value);
      return acc;
    }, {});
  }

  // Ingest USER.md file
  ingestUserMd(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn('Vault: USER.md not found', { filePath });
        return { success: false, error: 'File not found' };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Store raw content
      this.storeIdentity('user_md_raw', content, 'identity', {
        source: filePath,
        ingested_at: Date.now()
      });

      // Parse and extract structured data
      const parsed = this.parseUserMd(content);
      
      // Store parsed sections
      Object.entries(parsed).forEach(([key, value]) => {
        this.storeIdentity(`user_${key}`, value, 'identity_parsed');
      });

      logger.info('Vault: Ingested USER.md', { filePath, sections: Object.keys(parsed).length });
      
      return { success: true, sections: Object.keys(parsed) };
    } catch (error) {
      logger.error('Vault: Failed to ingest USER.md', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Simple USER.md parser (can be enhanced)
  parseUserMd(content) {
    const sections = {};
    const lines = content.split('\n');
    let currentSection = 'overview';
    let currentContent = [];

    lines.forEach(line => {
      if (line.startsWith('##')) {
        // Save previous section
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        // Start new section
        currentSection = line.replace(/^##\s*/, '').toLowerCase().replace(/\s+/g, '_');
        currentContent = [];
      } else if (line.startsWith('#')) {
        // Main title
        sections['title'] = line.replace(/^#\s*/, '').trim();
      } else {
        currentContent.push(line);
      }
    });

    // Save last section
    if (currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }

  // Store connector configuration
  storeConnector(id, name, type, config) {
    const encrypted = this.encryption.encrypt(config);
    const timestamp = Date.now();
    
    const stmt = this.db.prepare(`
      INSERT INTO connectors (id, name, type, config_encrypted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        config_encrypted = excluded.config_encrypted,
        updated_at = excluded.updated_at
    `);
    
    stmt.run(id, name, type, encrypted, timestamp, timestamp);
    logger.info('Vault: Stored connector', { id, name, type });
  }

  // Get connector
  getConnector(id) {
    const stmt = this.db.prepare('SELECT * FROM connectors WHERE id = ? AND enabled = 1');
    const row = stmt.get(id);
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      config: this.encryption.decryptJSON(row.config_encrypted),
      enabled: row.enabled === 1
    };
  }

  // List all connectors
  listConnectors() {
    const stmt = this.db.prepare('SELECT id, name, type, enabled FROM connectors');
    return stmt.all();
  }
}

module.exports = Vault;
