
// ============================================================================
// SECURITY FIX: IDOR (Insecure Direct Object Reference) Prevention
// CVSS: 8.2-8.7 (High)
// ============================================================================

/**
 * Verify user owns/has access to a resource
 * CVSS 8.7: User Management IDOR - allows modifying other users
 */
async function verifyResourceOwnership(userId, resourceId, resourceType, db) {
  if (!userId || !resourceId || !resourceType) {
    throw new Error('Missing required parameters');
  }
  
  const query = `
    SELECT owner_id, user_id FROM ${resourceType}s 
    WHERE id = ? AND (owner_id = ? OR user_id = ?)
  `;
  
  const result = await db.get(query, [resourceId, userId, userId]);
  
  if (!result) {
    throw new Error('Access denied: Resource not found or not owned by user');
  }
  
  return result;
}

/**
 * Verify user has access to tenant resources
 * CVSS 8.7: Tenant Isolation - users could access other tenant data
 */
async function verifyTenantAccess(userId, tenantId, db) {
  if (!userId || !tenantId) {
    throw new Error('Missing user or tenant ID');
  }
  
  const query = `
    SELECT id FROM tenant_members 
    WHERE user_id = ? AND tenant_id = ? AND status = 'active'
  `;
  
  const membership = await db.get(query, [userId, tenantId]);
  
  if (!membership) {
    throw new Error('Access denied: User not member of this tenant');
  }
  
  return membership;
}

/**
 * Device management authorization
 * CVSS 8.2: Device Approval - users could approve/revoke others' devices
 */
async function verifyDeviceOwnership(userId, deviceId, db) {
  const query = `
    SELECT id FROM devices 
    WHERE id = ? AND user_id = ? AND deleted_at IS NULL
  `;
  
  const device = await db.get(query, [deviceId, userId]);
  
  if (!device) {
    throw new Error('Access denied: Device not found or not owned by user');
  }
  
  return device;
}

/**
 * API key authorization
 * CVSS 8.2: API Keys - users could list/delete others' API keys
 */
async function verifyAPIKeyOwnership(userId, apiKeyId, db) {
  const query = `
    SELECT id, user_id FROM api_keys 
    WHERE id = ? AND user_id = ? AND revoked_at IS NULL
  `;
  
  const key = await db.get(query, [apiKeyId, userId]);
  
  if (!key) {
    throw new Error('Access denied: API key not found or not owned by user');
  }
  
  return key;
}

/**
 * Knowledge base document authorization
 * CVSS 8.2: KB Documents - users could delete/modify others' KB docs
 */
async function verifyKBDocAccess(userId, docId, requiredScope, db) {
  const query = `
    SELECT id, created_by FROM knowledge_base_docs 
    WHERE id = ? AND (created_by = ? OR is_public = true)
  `;
  
  const doc = await db.get(query, [docId, userId]);
  
  if (!doc) {
    throw new Error('Access denied: KB document not found');
  }
  
  // Only creator can modify (even if is_public for reading)
  if (requiredScope === 'write' && doc.created_by !== userId) {
    throw new Error('Access denied: Only creator can modify KB documents');
  }
  
  return doc;
}

/**
 * Memory/personal data authorization
 * CVSS 8.2: Memory - users could read/modify others' memories
 */
async function verifyMemoryAccess(userId, memoryId, db) {
  const query = `
    SELECT id FROM memories 
    WHERE id = ? AND user_id = ? AND deleted_at IS NULL
  `;
  
  const memory = await db.get(query, [memoryId, userId]);
  
  if (!memory) {
    throw new Error('Access denied: Memory not found or not owned by user');
  }
  
  return memory;
}

/**
 * Persona authorization
 * CVSS 8.2: Personas - users could edit/delete others' personas
 */
async function verifyPersonaAccess(userId, personaId, requiredScope, db) {
  const query = `
    SELECT id, owner_id FROM personas 
    WHERE id = ? AND owner_id = ?
  `;
  
  const persona = await db.get(query, [personaId, userId]);
  
  if (!persona) {
    throw new Error('Access denied: Persona not found or not owned by user');
  }
  
  return persona;
}

/**
 * Invitation authorization
 * CVSS 8.2: Invitations - users could modify others' invitations
 */
async function verifyInvitationOwnership(userId, invitationId, db) {
  const query = `
    SELECT id FROM invitations 
    WHERE id = ? AND created_by = ? AND status = 'pending'
  `;
  
  const invitation = await db.get(query, [invitationId, userId]);
  
  if (!invitation) {
    throw new Error('Access denied: Invitation not found or not owned by user');
  }
  
  return invitation;
}

/**
 * Token vault authorization
 * CVSS 8.2: Token Vault - users could list/access others' stored tokens
 */
async function verifyTokenVaultAccess(userId, tokenId, db) {
  const query = `
    SELECT id FROM vault_tokens 
    WHERE id = ? AND user_id = ? AND deleted_at IS NULL
  `;
  
  const token = await db.get(query, [tokenId, userId]);
  
  if (!token) {
    throw new Error('Access denied: Token not found in user vault');
  }
  
  return token;
}

/**
 * Token revocation authorization
 * CVSS 7.5: Token Revocation - users could revoke others' tokens
 */
async function verifyTokenOwnership(userId, tokenId, db) {
  const query = `
    SELECT id, user_id FROM tokens 
    WHERE id = ? AND user_id = ?
  `;
  
  const token = await db.get(query, [tokenId, userId]);
  
  if (!token) {
    throw new Error('Access denied: Token not found or not owned by user');
  }
  
  return token;
}

module.exports = {
  verifyResourceOwnership,
  verifyTenantAccess,
  verifyDeviceOwnership,
  verifyAPIKeyOwnership,
  verifyKBDocAccess,
  verifyMemoryAccess,
  verifyPersonaAccess,
  verifyInvitationOwnership,
  verifyTokenVaultAccess,
  verifyTokenOwnership
};
