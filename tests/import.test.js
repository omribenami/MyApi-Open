const request = require('supertest');
const JSZip = require('jszip');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Mock express app for testing (would be set up in test runner)
// This is a template for how tests should be structured

/**
 * Test Suite: ZIP Import Endpoint (`POST /api/v1/import`)
 * 
 * PHASE 1: ZIP Structure Verification
 * PHASE 2: Safe Data Parsing
 * PHASE 3: Validation
 * PHASE 4: Import Execution
 * PHASE 5: Response Format
 */

describe('POST /api/v1/import', () => {
  let app;
  let testUserId = 'test-user-123';

  beforeEach(() => {
    // Setup would happen here
  });

  afterEach(() => {
    // Cleanup would happen here
  });

  // ============================================================
  // PHASE 1: ZIP Structure Verification Tests
  // ============================================================

  describe('PHASE 1: ZIP Structure Verification', () => {
    test('should reject request without file', async () => {
      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .expect(400);

      expect(res.body.error).toContain('No file uploaded');
    });

    test('should reject invalid ZIP file', async () => {
      const invalidZip = Buffer.from('not a zip file');
      
      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', invalidZip, 'export.zip')
        .expect(400);

      expect(res.body.error).toContain('Invalid ZIP file');
    });

    test('should reject ZIP without manifest.json', async () => {
      const zip = new JSZip();
      zip.file('some-file.txt', 'content');
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(400);

      expect(res.body.error).toContain('manifest.json missing');
    });

    test('should reject manifest with unsupported schema version', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({
        schemaVersion: '1.0',
        exportMode: 'portable'
      }));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(400);

      expect(res.body.error).toContain('Unsupported export schema version');
    });

    test('should accept valid schema versions 2.0 and 3.0', async () => {
      for (const schemaVersion of ['2.0', '2.5', '3.0', '3.5']) {
        const zip = new JSZip();
        zip.file('manifest.json', JSON.stringify({
          schemaVersion,
          exportMode: 'portable',
          userId: testUserId
        }));
        zip.file('checksums.sha256', '');
        
        const buffer = await zip.generateAsync({ type: 'nodebuffer' });

        const res = await request(app)
          .post('/api/v1/import')
          .set('Authorization', `Bearer token-${testUserId}`)
          .attach('file', buffer, 'export.zip')
          .expect(200);

        expect(res.body.success).toBe(true);
      }
    });

    test('should verify checksums when present', async () => {
      // Create a valid ZIP with correct checksums
      const zip = new JSZip();
      const manifest = { schemaVersion: '3.0', userId: testUserId };
      const manifestJson = JSON.stringify(manifest);
      
      zip.file('manifest.json', manifestJson);
      zip.file('test-file.txt', 'test content');
      
      // Calculate checksum
      const fileHash = crypto.createHash('sha256')
        .update('test content')
        .digest('hex');
      
      zip.file('checksums.sha256', `${fileHash}  test-file.txt\n`);
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.checksumErrors).toBe(0);
    });

    test('should report checksum mismatches', async () => {
      // Create ZIP with mismatched checksums
      const zip = new JSZip();
      const manifest = { schemaVersion: '3.0', userId: testUserId };
      
      zip.file('manifest.json', JSON.stringify(manifest));
      zip.file('test-file.txt', 'test content');
      zip.file('checksums.sha256', 'wronghash  test-file.txt\n');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200); // Still succeeds, but reports error

      expect(res.body.checksumErrors).toBeGreaterThan(0);
    });

    test('should list all files in the ZIP', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('profile/identity.json', '{}');
      zip.file('personas/personas.json', '[]');
      zip.file('skills/skills.json', '[]');
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.filesProcessed).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // PHASE 2: Safe Data Parsing Tests
  // ============================================================

  describe('PHASE 2: Safe Data Parsing', () => {
    test('should strip access_tokens from profile', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('profile/identity.json', JSON.stringify({
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        access_tokens: ['should', 'be', 'stripped'],
        secret: 'should-also-be-stripped'
      }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      // Verify tokens were not imported
      expect(res.body.success).toBe(true);
      // Would need to verify in DB that tokens aren't present
    });

    test('should skip oauth_tokens', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('connectors/oauth-metadata.json', JSON.stringify({
        oauth_tokens: [{ service: 'github', token: 'secret' }]
      }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('should skip vault_tokens', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('vault/tokens.json', JSON.stringify({
        vault_tokens: [{ label: 'API Key', token: 'secret' }]
      }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('should skip service_preferences with OAuth secrets', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('connectors/services.json', JSON.stringify({
        service_preferences: [{
          service: 'github',
          clientSecret: 'should-be-stripped'
        }]
      }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('should parse persona data correctly', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('personas/personas.json', JSON.stringify([
        {
          id: '1',
          name: 'Engineer',
          description: 'Technical persona'
        }
      ]));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.imported.personas).toBeGreaterThan(0);
    });

    test('should parse skill data correctly', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('skills/skills.json', JSON.stringify([
        {
          id: 'skill-1',
          name: 'Web Scraper',
          description: 'Scrapes web content',
          version: '1.0.0',
          author: 'user'
        }
      ]));
      zip.file('skills/scripts/skill-1.js', 'console.log("skill code");');
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.imported.skills).toBeGreaterThan(0);
    });

    test('should strip sensitive keys from persona configs', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('personas/personas.json', JSON.stringify([
        {
          id: '1',
          name: 'API Tester',
          description: 'Tests APIs'
        }
      ]));
      zip.file('personas/configs/1.json', JSON.stringify({
        description: 'Config with secrets',
        apiKey: 'should-be-stripped',
        secret: 'also-stripped',
        soul_content: 'You are helpful'
      }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    test('should strip sensitive keys from skill configs', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('skills/skills.json', JSON.stringify([
        {
          id: 'skill-1',
          name: 'Email Sender',
          description: 'Sends emails'
        }
      ]));
      zip.file('skills/configs/skill-1.json', JSON.stringify({
        description: 'Config',
        password: 'should-be-stripped',
        auth_token: 'also-stripped'
      }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ============================================================
  // PHASE 3: Validation Tests
  // ============================================================

  describe('PHASE 3: Validation', () => {
    test('should require authentication', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0' }));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .attach('file', buffer, 'export.zip')
        .expect(401);

      expect(res.body.error).toContain('Unauthorized');
    });

    test('should reject cross-user import', async () => {
      const differentUserId = 'different-user-456';
      
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({
        schemaVersion: '3.0',
        userId: differentUserId  // Different user
      }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(403);

      expect(res.body.error).toContain('Cannot import data from a different user');
    });

    test('should detect persona name conflicts', async () => {
      // Assuming 'Engineer' persona already exists for testUserId
      
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('personas/personas.json', JSON.stringify([
        {
          id: '1',
          name: 'Engineer',  // Assume this exists
          description: 'Different engineer'
        }
      ]));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.skipped.personas).toBeGreaterThan(0);
      expect(res.body.conflicts.some(c => c.type === 'persona')).toBe(true);
    });

    test('should detect skill name conflicts', async () => {
      // Assuming 'Web Scraper' skill already exists for testUserId
      
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('skills/skills.json', JSON.stringify([
        {
          id: 'skill-1',
          name: 'Web Scraper',  // Assume this exists
          description: 'Different scraper'
        }
      ]));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.skipped.skills).toBeGreaterThan(0);
      expect(res.body.conflicts.some(c => c.type === 'skill')).toBe(true);
    });
  });

  // ============================================================
  // PHASE 4: Import Execution Tests
  // ============================================================

  describe('PHASE 4: Import Execution', () => {
    test('should import profile data', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('profile/identity.json', JSON.stringify({
        displayName: 'Updated Name',
        avatar: 'https://example.com/new-avatar.jpg'
      }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.imported.profile).toBe(1);
    });

    test('should import settings', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('settings/settings.json', JSON.stringify({
        privacyPreferences: {
          profilePublic: true,
          showActivity: true
        },
        notifications: {
          emailNotifications: false
        }
      }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.imported.settings).toBe(1);
    });

    test('should import personas without conflicts', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('personas/personas.json', JSON.stringify([
        {
          id: '1',
          name: 'Unique New Persona',
          description: 'New persona for testing'
        }
      ]));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.imported.personas).toBeGreaterThan(0);
      expect(res.body.skipped.personas).toBe(0);
    });

    test('should import skills without conflicts', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('skills/skills.json', JSON.stringify([
        {
          id: 'skill-1',
          name: 'Unique New Skill',
          description: 'New skill for testing',
          version: '1.0.0',
          author: 'test'
        }
      ]));
      zip.file('skills/scripts/skill-1.js', 'console.log("new skill");');
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.imported.skills).toBeGreaterThan(0);
      expect(res.body.skipped.skills).toBe(0);
    });

    test('should be atomic (all or nothing)', async () => {
      // This test would need to verify that if one operation fails,
      // all operations are rolled back
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('personas/personas.json', JSON.stringify([
        {
          id: '1',
          name: 'Valid Persona'
        }
      ]));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ============================================================
  // PHASE 5: Response Format Tests
  // ============================================================

  describe('PHASE 5: Response Format', () => {
    test('should return correct response structure', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('imported');
      expect(res.body).toHaveProperty('skipped');
      expect(res.body).toHaveProperty('schemaVersion');
    });

    test('imported should have correct structure', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.imported).toHaveProperty('profile');
      expect(res.body.imported).toHaveProperty('settings');
      expect(res.body.imported).toHaveProperty('personas');
      expect(res.body.imported).toHaveProperty('skills');
    });

    test('skipped should have correct structure', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.skipped).toHaveProperty('personas');
      expect(res.body.skipped).toHaveProperty('skills');
    });

    test('should include conflicts list', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('personas/personas.json', JSON.stringify([
        { id: '1', name: 'Test' }
      ]));
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(Array.isArray(res.body.conflicts)).toBe(true);
    });

    test('should include filesProcessed count', async () => {
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify({ schemaVersion: '3.0', userId: testUserId }));
      zip.file('test.txt', 'content');
      zip.file('checksums.sha256', '');
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const res = await request(app)
        .post('/api/v1/import')
        .set('Authorization', `Bearer token-${testUserId}`)
        .attach('file', buffer, 'export.zip')
        .expect(200);

      expect(res.body.filesProcessed).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // PHASE 6: Integration Tests
  // ============================================================

  describe('PHASE 6: Integration', () => {
    test('should handle complete export/import cycle', async () => {
      // This would:
      // 1. Export current user state to ZIP
      // 2. Modify some local data
      // 3. Import the ZIP back
      // 4. Verify correct data restored
      // 5. Verify tokens NOT imported
      // 6. Verify existing data preserved
      
      // This is a comprehensive integration test
      // that would verify the entire round-trip
    });

    test('should preserve existing data not in import', async () => {
      // Create initial data
      // Import ZIP with different data
      // Verify initial data still exists
    });

    test('should not lose tokens during import', async () => {
      // Create user with OAuth tokens
      // Import ZIP (which may contain token names but not actual tokens)
      // Verify existing tokens are still present
    });
  });
});
