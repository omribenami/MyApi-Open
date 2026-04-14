/**
 * ENDPOINT CAPABILITY DOCUMENTATION STANDARD
 * 
 * This standard defines how every MyApi endpoint should be documented
 * so that AI agents can discover and use functionality automatically.
 */

const ENDPOINT_DOCUMENTATION_STANDARD = {
  requirement: 'EVERY endpoint must include capability documentation',
  
  minimum_fields: {
    summary: 'One-line summary of what the endpoint does',
    description: 'Paragraph explaining purpose, when to use it, any gotchas',
    capabilities: 'Array of specific things this endpoint can do',
    requires_scope: 'Required token scope (or "master" if master-only)',
    requires_master_token: 'Boolean - true if ONLY master token works',
    returns: 'What the successful response contains',
    examples: 'Real examples of request/response'
  },

  critical_cases: {
    'read_operations': {
      pattern: 'Endpoints that return data',
      must_document: [
        'What fields are in the response',
        'Are any values masked/hidden for security?',
        'If masked, what endpoint reveals the full value?'
      ]
    },

    'write_operations': {
      pattern: 'Endpoints that modify data',
      must_document: [
        'What fields are required',
        'What fields are optional',
        'What scopes allow this operation',
        'What data is returned after write'
      ]
    },

    'secret_operations': {
      pattern: 'Endpoints that handle credentials/secrets',
      critical: 'MUST clearly state which endpoint decrypts/reveals values',
      example_problem: 'Vault tokens were masked in GET /vault/tokens but the /reveal endpoint was not obvious',
      solution: 'Every masked field should document: "To get actual value, use GET /api/v1/vault/tokens/{id}/reveal"'
    }
  },

  openapi_improvements: {
    current_issue: 'OpenAPI summaries are too brief for AI discovery',
    example_bad: "summary: 'Reveal vault token'",
    example_good: "summary: 'Decrypt and reveal vault token value (MASTER TOKEN REQUIRED)',
          description: 'Returns the decrypted actual token/credential value. Critical: Only master token works. All access logged.'"
  },

  integration_checklist: {
    step1: 'For each endpoint, write detailed OpenAPI description',
    step2: 'Create capability docs in src/docs/<feature>-endpoints.js',
    step3: 'Include workflow examples showing step-by-step usage',
    step4: 'Document ALL auth requirements and scope limitations',
    step5: 'Highlight any endpoints that reveal/decrypt masked data',
    step6: 'Note any security implications or audit logging',
    step7: 'Show real examples with sample token IDs and responses'
  },

  for_ai_agents: {
    discovery: 'AI agents read OpenAPI descriptions and capability docs to understand what they can do',
    blindspot: 'If an endpoint exists but is not documented, agents cannot use it (as happened with /reveal)',
    solution: 'Every endpoint MUST have clear, discoverable documentation in OpenAPI + supplementary docs'
  }
};

module.exports = ENDPOINT_DOCUMENTATION_STANDARD;

