/**
 * VAULT TOKEN ENDPOINTS - CAPABILITY DOCUMENTATION
 * 
 * CRITICAL: The /reveal endpoint is required to retrieve actual token values.
 * Without it, vault tokens cannot be used programmatically.
 */

const VAULT_CAPABILITIES = {
  endpoints: {
    'GET /api/v1/vault/tokens': {
      summary: 'List all vault tokens (values masked)',
      purpose: 'Discover what credentials are stored',
      returns: 'Array of tokens with preview only',
      note: 'Values are NOT returned here - use /reveal endpoint'
    },

    'POST /api/v1/vault/tokens': {
      summary: 'Store a new API token, SSH key, or credential',
      purpose: 'Securely save credentials',
      required_fields: ['label', 'token'],
      returns: 'Created token with ID'
    },

    'GET /api/v1/vault/tokens/{id}': {
      summary: 'Get token metadata (values still masked)',
      important: 'Value is STILL MASKED. Use /reveal for actual value.'
    },

    'GET /api/v1/vault/tokens/{id}/reveal': {
      summary: '*** DECRYPT AND RETURN THE ACTUAL TOKEN VALUE ***',
      purpose: 'Get full unencrypted credential for use',
      required_auth: 'MASTER TOKEN ONLY',
      returns: 'Decrypted token in response.data.token',
      critical: 'THIS ENDPOINT IS REQUIRED TO USE VAULT TOKENS PROGRAMMATICALLY'
    },

    'DELETE /api/v1/vault/tokens/{id}': {
      summary: 'Delete a vault token',
      required_auth: 'MASTER TOKEN'
    }
  }
};

module.exports = VAULT_CAPABILITIES;
