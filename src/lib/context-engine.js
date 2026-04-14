const fs = require('fs');
const path = require('path');
const { getConversationHistory, getCachedContext, cacheContext, getKBDocumentById, getMemories } = require('../database');

/**
 * Context Assembly Engine
 * Loads and combines user profile, persona, memory, and recent context
 * to create an augmented context for LLM consumption
 */

class ContextEngine {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot ||
      (process.env.USER_MD_PATH ? path.dirname(process.env.USER_MD_PATH) : path.join(__dirname, '../../../../'));
    this.cacheEnabled = options.cacheEnabled !== false;
    this.cacheTTL = options.cacheTTL || 3600; // 1 hour
    this.maxHistoryMessages = options.maxHistoryMessages || 10;
  }

  /**
   * Load USER.md - User identity and profile
   */
  loadUserProfile() {
    try {
      const userMdPath = path.join(this.workspaceRoot, 'USER.md');
      if (!fs.existsSync(userMdPath)) {
        return { name: 'User', profile: {} };
      }

      const content = fs.readFileSync(userMdPath, 'utf8');
      const profile = this._parseMarkdown(content);

      return {
        name: profile.name || 'User',
        profile,
        source: 'USER.md'
      };
    } catch (error) {
      console.error('Error loading USER profile:', error);
      return { name: 'User', profile: {} };
    }
  }

  /**
   * Load active SOUL.md - Persona and personality
   */
  loadPersona() {
    try {
      const soulMdPath = path.join(this.workspaceRoot, 'SOUL.md');
      if (!fs.existsSync(soulMdPath)) {
        return { name: 'Jarvis', persona: {} };
      }

      const content = fs.readFileSync(soulMdPath, 'utf8');
      const persona = this._parseMarkdown(content);

      return {
        name: persona.name || 'Jarvis',
        persona,
        source: 'SOUL.md'
      };
    } catch (error) {
      console.error('Error loading persona:', error);
      return { name: 'Jarvis', persona: {} };
    }
  }

  /**
   * Load MEMORY.md - Long-term memory
   */
  loadMemory(ownerId = 'owner') {
    try {
      // DB memories (structured, with id + timestamp)
      let dbMemories = [];
      try {
        dbMemories = getMemories(ownerId);
      } catch (_) {}

      // Legacy MEMORY.md bullets
      const memoryMdPath = path.join(this.workspaceRoot, 'MEMORY.md');
      let fileMemories = [];
      if (fs.existsSync(memoryMdPath)) {
        const content = fs.readFileSync(memoryMdPath, 'utf8');
        fileMemories = content.split('\n')
          .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
          .map(line => line.replace(/^[\s\-\*]+/, '').trim())
          .filter(line => line.length > 0);
      }

      // Unified list: DB entries as strings (newest first), then file bullets
      const memories = [
        ...dbMemories.map(m => m.content),
        ...fileMemories,
      ];

      return { memories, dbMemories, fileMemories };
    } catch (error) {
      console.error('Error loading memory:', error);
      return { memories: [], dbMemories: [], fileMemories: [] };
    }
  }

  /**
   * Get recent conversation history
   */
  getRecentMessages(conversationId) {
    if (!conversationId) return [];

    try {
      const messages = getConversationHistory(conversationId, this.maxHistoryMessages);
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt
      }));
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Retrieve relevant context documents from knowledge base
   */
  retrieveRelevantDocuments(query, db, topK = 3) {
    try {
      // For now, return a few documents as examples
      // In a full implementation, this would do semantic search
      const allDocs = [];
      
      // Return empty array if no semantic search available
      return allDocs.slice(0, topK);
    } catch (error) {
      console.error('Error retrieving documents:', error);
      return [];
    }
  }

  /**
   * Assemble complete context for LLM
   */
  async assembleContext(conversationId, db) {
    // Check cache first
    const cacheKey = `context:${conversationId}`;
    if (this.cacheEnabled) {
      const cached = getCachedContext(cacheKey);
      if (cached) {
        return cached.value;
      }
    }

    // Load all components
    const userProfile = this.loadUserProfile();
    const persona = this.loadPersona();
    const memory = this.loadMemory();
    const recentMessages = this.getRecentMessages(conversationId);

    // Build system prompt
    const systemPrompt = this._buildSystemPrompt(userProfile, persona, memory);

    const context = {
      user: userProfile,
      persona,
      memory,
      recentMessages,
      systemPrompt,
      assembledAt: new Date().toISOString()
    };

    // Cache the context
    if (this.cacheEnabled) {
      cacheContext(cacheKey, context, this.cacheTTL);
    }

    return context;
  }

  /**
   * Sanitize a string for safe inclusion in an LLM system prompt.
   * Strips control characters and injection patterns that attempt to override
   * the system prompt or inject new roles (prompt injection mitigation).
   */
  _sanitizeForPrompt(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    // Strip control characters (keep tab and newline which are valid in prompts)
    let safe = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Strip common prompt injection patterns
    const injectionPatterns = [
      /\n\n---+/g,
      /\nSystem\s*:/gi,
      /\nUser\s*:/gi,
      /\nAssistant\s*:/gi,
      /\nHuman\s*:/gi,
      /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
      /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
      /you\s+are\s+now\s+/gi,
      /act\s+as\s+/gi,
    ];
    for (const pattern of injectionPatterns) {
      safe = safe.replace(pattern, ' ');
    }
    return safe.slice(0, maxLength);
  }

  /**
   * Build system prompt from components
   */
  _buildSystemPrompt(userProfile, persona, memory) {
    const parts = [];

    // Identity
    const personaName = this._sanitizeForPrompt(persona.name, 100);
    parts.push(`You are ${personaName}, an AI assistant.`);

    if (persona.persona && persona.persona.purpose) {
      const purpose = this._sanitizeForPrompt(persona.persona.purpose, 500);
      parts.push(`Your purpose: ${purpose}`);
    }

    // User context
    if (userProfile.profile && userProfile.profile.name) {
      const userName = this._sanitizeForPrompt(userProfile.profile.name, 100);
      parts.push(`You are assisting ${userName}.`);
    }

    // Memories
    if (memory.memories && memory.memories.length > 0) {
      parts.push('\nKey memories:');
      memory.memories.slice(0, 5).forEach(mem => {
        const safeMem = this._sanitizeForPrompt(String(mem), 200);
        parts.push(`- ${safeMem}`);
      });
    }

    // Behavioral guidelines
    parts.push(
      '\nBehavioral guidelines:',
      '- Be helpful, harmless, and honest',
      '- Respect user privacy and preferences',
      '- Provide accurate information',
      '- Ask for clarification when needed'
    );

    return parts.join('\n');
  }

  /**
   * Parse markdown into key-value pairs
   */
  _parseMarkdown(content) {
    const result = {};
    const lines = content.split('\n');

    for (const line of lines) {
      // Match patterns like "- **Key**: Value" or "Key: Value"
      const match = line.match(/^\s*[-*]?\s*\*?\*?([^:*]+)\*?\*?:\s*(.+)/);
      if (match) {
        const key = match[1].trim().toLowerCase().replace(/\s+/g, '_').slice(0, 100);
        // Limit value length to prevent oversized injection via markdown keys
        const value = match[2].trim().slice(0, 500);
        result[key] = value;
      }
    }

    return result;
  }
}

module.exports = ContextEngine;
