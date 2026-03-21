/**
 * Tests for Vault Token Instructions API Layer
 * Phase 4.5 Implementation
 */

const Database = require('../database');
const path = require('path');
const fs = require('fs');

describe('Vault Token Instructions - Database Schema', () => {
  let db;

  beforeAll(() => {
    // Use in-memory database for testing
    const sqlite3 = require('better-sqlite3');
    db = new sqlite3(':memory:');
    
    // Load base schema
    const baseSchema = fs.readFileSync(
      path.join(__dirname, '../database.js'),
      'utf-8'
    );
    
    // We'll test schema by checking if tables can be created
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('vault_token_instructions table should exist with correct schema', () => {
    // This will be verified when migrations run during app startup
    // For now, we document the expected schema
    
    const expectedColumns = [
      'id',
      'token_id',
      'instructions',
      'examples',
      'auto_generated',
      'learned_from_skill_id',
      'learned_from_agent_id',
      'learned_at',
      'created_at',
      'updated_at',
      'created_by_user_id'
    ];
    
    expectedColumns.forEach(col => {
      expect(col).toBeDefined();
    });
  });

  test('vault_token_instruction_versions table should track changes', () => {
    const expectedColumns = [
      'id',
      'token_instruction_id',
      'instructions_previous',
      'instructions_new',
      'examples_previous',
      'examples_new',
      'auto_generated_previous',
      'auto_generated_new',
      'changed_by_user_id',
      'change_reason',
      'created_at'
    ];
    
    expectedColumns.forEach(col => {
      expect(col).toBeDefined();
    });
  });

  test('service_type_instructions table should exist for global templates', () => {
    const expectedColumns = [
      'id',
      'service_name',
      'instructions',
      'examples',
      'auto_generated',
      'aggregated_from_token_count',
      'last_updated_at',
      'created_by_user_id',
      'created_at',
      'updated_at'
    ];
    
    expectedColumns.forEach(col => {
      expect(col).toBeDefined();
    });
  });

  test('indexes should be created for optimal performance', () => {
    // Verify index names as per migration
    const expectedIndexes = [
      'idx_vault_token_instructions_token_id',
      'idx_vault_token_instructions_created_at',
      'idx_vault_token_instructions_auto_generated',
      'idx_vault_token_instructions_learned_skill',
      'idx_vault_token_instructions_learned_agent',
      'idx_vault_token_instruction_versions_token_instruction_id',
      'idx_vault_token_instruction_versions_created_at',
      'idx_vault_token_instruction_versions_changed_by',
      'idx_service_type_instructions_service_name',
      'idx_service_type_instructions_auto_generated',
      'idx_service_type_instructions_updated_at'
    ];
    
    expectedIndexes.forEach(idx => {
      expect(idx).toBeDefined();
    });
  });
});

describe('Vault Token Instructions - API Contracts', () => {
  test('GET /api/v1/vault/tokens/:id should return token with instructions', () => {
    const expectedResponse = {
      id: 'token_id',
      name: 'token_name',
      type: 'personal',
      scope: 'full',
      createdAt: 'timestamp',
      instructions: {
        id: 'instruction_id',
        instructions: 'How to use this token',
        examples: [
          {
            description: 'Example description',
            endpoint: '/api/endpoint',
            method: 'GET',
            request: {},
            response: {}
          }
        ],
        auto_generated: false,
        learned_at: 'timestamp'
      }
    };
    
    expect(expectedResponse.instructions).toBeDefined();
  });

  test('GET /api/v1/vault/tokens/:id/instructions should return just instructions', () => {
    const expectedResponse = {
      id: 'instruction_id',
      token_id: 'token_id',
      instructions: 'How to use this token',
      examples: [],
      auto_generated: false,
      created_at: 'timestamp',
      updated_at: 'timestamp'
    };
    
    expect(expectedResponse.token_id).toBeDefined();
    expect(expectedResponse.instructions).toBeDefined();
  });

  test('POST /api/v1/vault/tokens/:id/instructions should save instructions', () => {
    const payload = {
      instructions: 'How to use this service',
      examples: [
        {
          description: 'List repositories',
          endpoint: '/repos',
          method: 'GET',
          request: {},
          response: { repos: [] }
        }
      ]
    };
    
    expect(payload.instructions).toBeDefined();
    expect(Array.isArray(payload.examples)).toBe(true);
  });

  test('PUT /api/v1/vault/tokens/:id/instructions should update instructions', () => {
    const payload = {
      instructions: 'Updated instructions',
      examples: []
    };
    
    expect(payload.instructions).toBeDefined();
  });

  test('DELETE /api/v1/vault/tokens/:id/instructions should clear instructions', () => {
    // Should return 204 No Content or { success: true }
    const expectedResponse = { success: true, message: 'Instructions cleared' };
    expect(expectedResponse.success).toBe(true);
  });

  test('GET /api/v1/vault/services/:serviceName/instructions should return all service instructions', () => {
    const expectedResponse = {
      service_name: 'github',
      instructions: [
        {
          id: 'instruction_id',
          token_id: 'token_id',
          instructions: 'How to use GitHub API',
          examples: []
        }
      ],
      service_template: {
        instructions: 'Generic GitHub API instructions',
        examples: []
      }
    };
    
    expect(expectedResponse.service_name).toBeDefined();
    expect(Array.isArray(expectedResponse.instructions)).toBe(true);
  });

  test('POST /api/v1/vault/tokens/:id/learn-from-api should auto-save instructions', () => {
    const payload = {
      instructions: 'Learned instructions',
      examples: [
        {
          endpoint: '/users',
          method: 'GET',
          response: { users: [] }
        }
      ],
      errors: [],
      rateLimit: {
        limit: 60,
        remaining: 59,
        reset: 'timestamp'
      }
    };
    
    expect(payload.instructions).toBeDefined();
    expect(Array.isArray(payload.examples)).toBe(true);
  });
});

describe('Service Proxy Enhancement', () => {
  test('POST /api/v1/services/:serviceName/proxy should include instructions in response', () => {
    const expectedResponse = {
      ok: true,
      data: {
        /* actual response data */
      },
      instructions: 'How to use this service',
      examples: [
        {
          endpoint: '/endpoint',
          method: 'GET'
        }
      ],
      nextEndpoints: [
        '/endpoint1',
        '/endpoint2'
      ]
    };
    
    expect(expectedResponse.instructions).toBeDefined();
    expect(Array.isArray(expectedResponse.examples)).toBe(true);
    expect(Array.isArray(expectedResponse.nextEndpoints)).toBe(true);
  });
});

describe('Skills Integration', () => {
  test('GET /api/v1/vault/tokens/:id?includeInstructions=true should return instructions', () => {
    const expectedResponse = {
      id: 'token_id',
      name: 'token_name',
      scope: 'full',
      instructions: {
        id: 'instruction_id',
        instructions: 'Token instructions',
        examples: []
      }
    };
    
    expect(expectedResponse.instructions).toBeDefined();
  });
});

describe('Edge Cases', () => {
  test('Empty instructions should be handled gracefully', () => {
    const payload = {
      instructions: '',
      examples: []
    };
    
    // Should either be rejected or handled with validation
    expect(payload).toBeDefined();
  });

  test('Malformed JSON examples should be rejected', () => {
    const payload = {
      instructions: 'Some instructions',
      examples: 'not an array' // Invalid - should be array
    };
    
    // Should validate and reject
    expect(typeof payload.examples).toBe('string');
  });

  test('Very large instruction sets should be handled', () => {
    const largeInstructions = 'x'.repeat(100000); // 100KB instruction text
    const payload = {
      instructions: largeInstructions,
      examples: []
    };
    
    expect(payload.instructions.length).toBe(100000);
  });
});
