const logger = require('../utils/logger');

class PersonalBrain {
  constructor(vault, auditLog) {
    this.vault = vault;
    this.auditLog = auditLog;
  }

  // Evaluate request and decide what data to expose
  async evaluateRequest(tokenData, requestType, requestParams = {}) {
    const { type: tokenType, scope } = tokenData;

    logger.info('Brain: Evaluating request', {
      tokenType,
      requestType,
      scope
    });

    // Personal tokens have full access
    if (tokenType === 'personal') {
      return this.handlePersonalRequest(requestType, requestParams);
    }

    // Guest tokens have scoped access
    if (tokenType === 'guest') {
      return this.handleGuestRequest(scope, requestType, requestParams);
    }

    throw new Error('Invalid token type');
  }

  // Handle personal token requests (full access)
  async handlePersonalRequest(requestType, params) {
    switch (requestType) {
      case 'identity:get':
        return this.getIdentityData(params.key, false);
      
      case 'identity:list':
        return this.listIdentityData(params.category, false);
      
      case 'identity:all':
        return this.getAllIdentityData(false);
      
      case 'preferences:get':
        return this.getPreference(params.key);
      
      case 'preferences:list':
        return this.listPreferences(params.category);
      
      case 'connectors:list':
        return this.vault.listConnectors();
      
      default:
        throw new Error(`Unknown request type: ${requestType}`);
    }
  }

  // Handle guest token requests (scoped access)
  async handleGuestRequest(scope, requestType, params) {
    // Check if request type is in scope
    if (!this.isInScope(scope, requestType)) {
      logger.warn('Brain: Request denied - out of scope', {
        scope,
        requestType
      });
      throw new Error('Access denied: request type not in token scope');
    }

    // Apply privacy filters based on scope
    switch (requestType) {
      case 'identity:get':
        if (!scope.identity || !scope.identity.includes(params.key)) {
          throw new Error('Access denied: identity key not in scope');
        }
        return this.getIdentityData(params.key, true);
      
      case 'identity:list':
        if (!scope.identity) {
          throw new Error('Access denied: identity not in scope');
        }
        return this.listIdentityData(params.category, true, scope.identity);
      
      case 'preferences:get':
        if (!scope.preferences || !scope.preferences.includes(params.key)) {
          throw new Error('Access denied: preference key not in scope');
        }
        return this.getPreference(params.key);
      
      case 'preferences:list':
        if (!scope.preferences) {
          throw new Error('Access denied: preferences not in scope');
        }
        return this.listPreferences(params.category, scope.preferences);
      
      default:
        throw new Error(`Access denied: ${requestType} not allowed for guest tokens`);
    }
  }

  // Check if request is in scope
  isInScope(scope, requestType) {
    const [category] = requestType.split(':');
    return scope[category] !== undefined;
  }

  // Get identity data with optional privacy filtering
  getIdentityData(key, applyPrivacy = false) {
    const data = this.vault.getIdentity(key);
    
    if (!data) {
      return null;
    }

    if (applyPrivacy) {
      // Redact sensitive information for guest tokens
      data.value = this.redactSensitiveData(data.value);
    }

    return data;
  }

  // List identity data with optional filtering
  listIdentityData(category, applyPrivacy = false, allowedKeys = null) {
    const data = this.vault.getIdentityByCategory(category);
    
    let filtered = data;

    // Filter by allowed keys if specified
    if (allowedKeys) {
      filtered = data.filter(item => allowedKeys.includes(item.key));
    }

    // Apply privacy redaction
    if (applyPrivacy) {
      filtered = filtered.map(item => ({
        ...item,
        value: this.redactSensitiveData(item.value)
      }));
    }

    return filtered;
  }

  // Get all identity data
  getAllIdentityData(applyPrivacy = false) {
    const keys = this.vault.getAllIdentityKeys();
    const data = {};

    keys.forEach(({ key, category }) => {
      const item = this.vault.getIdentity(key);
      if (item) {
        if (!data[category]) {
          data[category] = {};
        }
        data[category][key] = applyPrivacy
          ? this.redactSensitiveData(item.value)
          : item.value;
      }
    });

    return data;
  }

  // Get preference
  getPreference(key) {
    return this.vault.getPreference(key);
  }

  // List preferences with optional filtering
  listPreferences(category, allowedKeys = null) {
    const prefs = this.vault.getPreferencesByCategory(category);
    
    if (allowedKeys) {
      const filtered = {};
      allowedKeys.forEach(key => {
        if (prefs[key] !== undefined) {
          filtered[key] = prefs[key];
        }
      });
      return filtered;
    }

    return prefs;
  }

  // Redact sensitive data (simple implementation, can be enhanced)
  redactSensitiveData(data) {
    if (typeof data === 'string') {
      // Redact email addresses
      data = data.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL REDACTED]');
      
      // Redact phone numbers (simple pattern)
      data = data.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REDACTED]');
      
      // Redact anything that looks like a SSN
      data = data.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN REDACTED]');
    } else if (typeof data === 'object' && data !== null) {
      // Recursively redact objects
      const redacted = Array.isArray(data) ? [] : {};
      for (const key in data) {
        redacted[key] = this.redactSensitiveData(data[key]);
      }
      return redacted;
    }

    return data;
  }

  // Data minimization: return only what's needed for the query
  minimizeData(data, requestParams) {
    // This is a placeholder for more sophisticated data minimization logic
    // In a real implementation, this would analyze the request and return
    // only the specific fields needed
    return data;
  }
}

module.exports = PersonalBrain;
