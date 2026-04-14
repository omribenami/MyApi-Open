/**
 * VAULT TOKENS - COMPLETE USAGE GUIDE
 * 
 * How to work with stored credentials (API keys, SSH keys, tokens, etc)
 */

// WORKFLOW: Store and use a credential
const WORKFLOW = {
  step1: {
    action: 'Store your SSH key',
    endpoint: 'POST /api/v1/vault/tokens',
    request: {
      label: 'My SSH Key',
      token: 'ssh-ed25519 AAAAC3NzaC...',
      service: 'remote-server',
      websiteUrl: 'https://192.168.1.17'
    },
    response: {
      id: 'vt_9bb872db...',
      token: 'stored-and-encrypted'
    }
  },

  step2: {
    action: 'List available stored credentials',
    endpoint: 'GET /api/v1/vault/tokens',
    note: 'Values are MASKED - you see preview only (ssh-***-HQ)',
    response: [{
      id: 'vt_9bb872db...',
      label: 'My SSH Key',
      tokenPreview: 'ssh-***-HQ'  // NOT the real key
    }]
  },

  step3: {
    action: 'Retrieve the actual credential value',
    endpoint: 'GET /api/v1/vault/tokens/{id}/reveal',
    requirement: 'MASTER TOKEN ONLY',
    request: {
      auth: 'Bearer <your-master-token>',
      token_id: 'vt_9bb872db...'
    },
    response: {
      data: {
        id: 'vt_9bb872db...',
        token: 'ssh-ed25519 AAAAC3NzaC...'  // FULL UNMASKED VALUE
      }
    }
  },

  step4: {
    action: 'Use the retrieved credential',
    example: 'Pass the token value to SSH, curl, or external service API'
  }
};

// CURL EXAMPLES
const EXAMPLES = {
  store_token: `
    curl -X POST https://www.myapiai.com/api/v1/vault/tokens \
      -H "Authorization: Bearer <master-token>" \
      -H "Content-Type: application/json" \
      -d '{
        "label": "Jarvis ssh",
        "token": "ssh-ed25519 AAAAC3...",
        "service": "jarvis-server"
      }'
  `,

  list_tokens: `
    curl https://www.myapiai.com/api/v1/vault/tokens \
      -H "Authorization: Bearer <any-token>"
  `,

  reveal_token: `
    curl https://www.myapiai.com/api/v1/vault/tokens/vt_9bb872db.../reveal \
      -H "Authorization: Bearer <MASTER-TOKEN-ONLY>"
  `
};

module.exports = { WORKFLOW, EXAMPLES };

