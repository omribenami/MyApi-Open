const axios = require('axios');

/**
 * LangChain-inspired Adapter for LLM Integration
 * Supports multiple models: Gemini, OpenAI, Claude, Ollama
 */

class LLMAdapter {
  constructor(config = {}) {
    this.model = config.model || 'gemini-pro';
    this.temperature = config.temperature || 0.7;
    this.topP = config.topP || 0.9;
    this.maxTokens = config.maxTokens || 2048;
    this.streaming = config.streaming || false;
    
    // API keys
    this.geminiKey = process.env.GOOGLE_API_KEY;
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.claudeKey = process.env.ANTHROPIC_API_KEY;
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  /**
   * Create a chat completion
   */
  async createCompletion(systemPrompt, userMessage, conversationHistory = []) {
    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Route to appropriate provider
    try {
      if (this.model.startsWith('gemini')) {
        return await this._callGemini(messages);
      } else if (this.model.startsWith('gpt')) {
        return await this._callOpenAI(messages);
      } else if (this.model.startsWith('claude')) {
        return await this._callClaude(messages);
      } else {
        return await this._callOllama(messages);
      }
    } catch (error) {
      // Fallback to mock response if API unavailable
      console.warn('LLM API unavailable, using mock response:', error.message);
      return this._getMockResponse(userMessage);
    }
  }

  /**
   * Get a mock response (for testing when APIs are unavailable)
   */
  _getMockResponse(userMessage) {
    const responses = {
      'who are you': 'I am MyApi Assistant, your personal AI assistant. I help you manage information, maintain memories, and provide intelligent responses based on your personal context.',
      'what is your name': 'My name is MyApi Assistant, your personal AI brain.',
      'hello': 'Hello! I am MyApi Assistant, your AI assistant. How can I help you today?',
      'what can you do': 'I can help you with conversations, answer questions using your personal knowledge base, and maintain context across our interactions.',
      'default': `I understand you said: "${userMessage}". Based on your personal context and knowledge base, I am ready to assist you. Please note that I am currently running in demo mode without API connectivity.`
    };

    const lowerMessage = userMessage.toLowerCase();
    let response = responses.default;

    for (const [key, value] of Object.entries(responses)) {
      if (key !== 'default' && lowerMessage.includes(key)) {
        response = value;
        break;
      }
    }

    return {
      response,
      tokensUsed: Math.ceil((userMessage.length + response.length) / 4),
      model: this.model + '-mock'
    };
  }

  /**
   * Call Google Gemini API
   */
  async _callGemini(messages) {
    if (!this.geminiKey) {
      const mockResponse = this._getMockResponse(messages[messages.length - 1]?.content || '');
      return Promise.resolve(mockResponse);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.geminiKey}`;

      // Convert messages to Gemini format
      const contents = messages
        .filter(m => m.role !== 'system') // Gemini handles system differently
        .map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

      // Add system prompt to first message
      const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
      if (systemPrompt && contents.length > 0) {
        contents[0].parts[0].text = systemPrompt + '\n\n' + contents[0].parts[0].text;
      }

      const response = await axios.post(url, {
        contents,
        generationConfig: {
          temperature: this.temperature,
          topP: this.topP,
          maxOutputTokens: this.maxTokens,
          stopSequences: ['```']
        }
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No response from Gemini');
      }

      return {
        response: text,
        tokensUsed: response.data.usageMetadata?.totalTokenCount || 0,
        model: this.model
      };
    } catch (error) {
      console.error('Gemini API error:', error.message);
      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  async _callOpenAI(messages) {
    if (!this.openaiKey) {
      const mockResponse = this._getMockResponse(messages[messages.length - 1]?.content || '');
      return Promise.resolve(mockResponse);
    }

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.model,
        messages,
        temperature: this.temperature,
        top_p: this.topP,
        max_tokens: this.maxTokens
      }, {
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        response: response.data.choices[0].message.content,
        tokensUsed: response.data.usage.total_tokens,
        model: this.model
      };
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      throw error;
    }
  }

  /**
   * Call Anthropic Claude API (placeholder)
   */
  async _callClaude(messages) {
    if (!this.claudeKey) {
      const mockResponse = this._getMockResponse(messages[messages.length - 1]?.content || '');
      return Promise.resolve(mockResponse);
    }

    try {
      // Claude API call would go here
      // For now, return a placeholder
      return {
        response: 'Claude integration not yet implemented',
        tokensUsed: 0,
        model: this.model
      };
    } catch (error) {
      console.error('Claude API error:', error.message);
      const mockResponse = this._getMockResponse(messages[messages.length - 1]?.content || '');
      return mockResponse;
    }
  }

  /**
   * Call local Ollama instance
   */
  async _callOllama(messages) {
    try {
      const prompt = messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n\n');

      const response = await axios.post(`${this.ollamaBaseUrl}/api/generate`, {
        model: this.model,
        prompt,
        temperature: this.temperature,
        top_p: this.topP,
        stream: false
      }, {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      });

      return {
        response: response.data.response,
        tokensUsed: 0,
        model: this.model
      };
    } catch (error) {
      console.error('Ollama API error:', error.message);
      const mockResponse = this._getMockResponse(messages[messages.length - 1]?.content || '');
      return mockResponse;
    }
  }

  /**
   * Create streaming completion
   */
  async createCompletionStream(systemPrompt, userMessage, conversationHistory = []) {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    // For now, return a simple completion
    // In production, this would return a stream
    const result = await this.createCompletion(systemPrompt, userMessage, conversationHistory);
    return result;
  }

  /**
   * Count tokens in a message (approximate)
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

module.exports = LLMAdapter;
