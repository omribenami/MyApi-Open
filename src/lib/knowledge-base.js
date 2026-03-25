const fs = require('fs');
const path = require('path');
const marked = require('marked');
const { 
  addKBDocument, 
  getKBDocuments, 
  getKBDocumentById,
  deleteKBDocument 
} = require('../database');

/**
 * Knowledge Base Integration
 * Manages documents, embeddings, and semantic search
 */

class KnowledgeBase {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || path.join(__dirname, '../../../../');
    this.chunkSize = options.chunkSize || 500; // words per chunk
    this.minChunkSize = options.minChunkSize || 50;
    this.embeddingModel = options.embeddingModel || 'simple-hash'; // Can be extended to use actual embedding models
  }

  /**
   * Load and seed initial knowledge base from workspace files
   */
  async seedInitialKnowledgeBase() {
    try {
      console.log('Seeding knowledge base...');
      
      const documents = [
        { path: 'USER.md', source: 'user-profile' },
        { path: 'SOUL.md', source: 'persona' },
        { path: 'MEMORY.md', source: 'memory' }
      ];

      for (const doc of documents) {
        const fullPath = path.join(this.workspaceRoot, doc.path);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          await this.addDocument(doc.source, doc.path, content);
        }
      }

      console.log('Knowledge base seeded successfully');
    } catch (error) {
      console.error('Error seeding knowledge base:', error);
    }
  }

  /**
   * Add a document to knowledge base
   */
  async addDocument(source, title, content, ownerId = 'owner') {
    try {
      const embedding = this._generateEmbedding(content);

      const doc = addKBDocument(
        source,
        title,
        content,
        embedding,
        { wordCount: content.split(/\s+/).length },
        ownerId
      );

      return [doc];
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  /**
   * Query knowledge base for relevant documents
   */
  queryKnowledgeBase(query, topK = 3, ownerId = 'owner') {
    try {
      const allDocs = getKBDocuments(ownerId);
      
      if (allDocs.length === 0) {
        return [];
      }

      // Simple relevance scoring based on keyword matching
      const queryTerms = query.toLowerCase().split(/\s+/);
      
      const scoredDocs = allDocs.map(doc => {
        const docText = `${doc.title} ${doc.source}`.toLowerCase();
        let score = 0;
        
        for (const term of queryTerms) {
          if (docText.includes(term)) {
            score += 1;
          }
        }

        return {
          ...doc,
          score
        };
      });

      // Sort by score and return top K
      return scoredDocs
        .filter(doc => doc.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    } catch (error) {
      console.error('Error querying knowledge base:', error);
      return [];
    }
  }

  /**
   * Remove document from knowledge base
   */
  removeDocument(documentId, ownerId = 'owner') {
    try {
      return deleteKBDocument(documentId, ownerId);
    } catch (error) {
      console.error('Error removing document:', error);
      throw error;
    }
  }

  /**
   * Get all documents
   */
  getAllDocuments(ownerId = 'owner') {
    try {
      return getKBDocuments(ownerId);
    } catch (error) {
      console.error('Error getting documents:', error);
      return [];
    }
  }

  /**
   * Get document content
   */
  getDocument(documentId, ownerId = 'owner') {
    try {
      return getKBDocumentById(documentId, ownerId);
    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }

  /**
   * Parse markdown into semantic chunks
   */
  _parseMarkdown(content) {
    const chunks = [];
    const lines = content.split('\n');
    
    let currentChunk = {
      text: '',
      section: 'General',
      index: 0
    };

    let chunkCount = 0;
    let wordCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect section headers
      if (line.startsWith('#')) {
        // Save previous chunk if it has content
        if (currentChunk.text.trim().length > this.minChunkSize) {
          chunks.push({
            ...currentChunk,
            index: chunkCount++
          });
        }

        // Start new chunk for this section
        const headerLevel = line.match(/^#+/)[0].length;
        const headerText = line.replace(/^#+\s*/, '').trim();
        
        currentChunk = {
          text: '',
          section: headerText,
          index: chunkCount
        };
        wordCount = 0;
        continue;
      }

      // Add line to current chunk
      currentChunk.text += line + '\n';
      wordCount += line.split(/\s+/).length;

      // Start new chunk if size limit reached
      if (wordCount > this.chunkSize) {
        if (currentChunk.text.trim().length > this.minChunkSize) {
          chunks.push({
            ...currentChunk,
            index: chunkCount++
          });
        }

        currentChunk = {
          text: '',
          section: currentChunk.section,
          index: chunkCount
        };
        wordCount = 0;
      }
    }

    // Add final chunk
    if (currentChunk.text.trim().length > this.minChunkSize) {
      chunks.push({
        ...currentChunk,
        index: chunkCount
      });
    }

    return chunks.length > 0 ? chunks : [{
      text: content,
      section: 'General',
      index: 0
    }];
  }

  /**
   * Generate embedding for a text chunk
   * Using simple hash-based approach - can be extended to use real embeddings
   */
  _generateEmbedding(text) {
    // Simple hash-based embedding representation
    // In production, would use OpenAI, HuggingFace, or other embedding service
    const normalized = text.toLowerCase().trim();
    const hash = this._simpleHash(normalized);
    
    // Return base64 encoded hash for storage
    return Buffer.from(hash.toString()).toString('base64');
  }

  /**
   * Simple hash function for demo purposes
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

module.exports = KnowledgeBase;
