# Personal Brain Setup & Configuration

## Overview

The Personal Brain is a context-aware AI response system that integrates LangChain capabilities with MyApi's identity and memory system. It provides intelligent, personalized responses by combining user profile, persona, conversation history, and knowledge base documents.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Brain API Endpoints                     │
│  /api/v1/brain/chat, /knowledge-base, /context, etc.   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼──┐  ┌─────▼──┐  ┌─────▼──┐
   │Context │  │  LLM   │  │Knowledge│
   │Engine  │  │Adapter │  │  Base   │
   └────┬──┘  └────┬────┘  └────┬────┘
        │          │            │
   ┌────▼──────────▼────────────▼────┐
   │     SQLite Database              │
   │  - conversations                 │
   │  - messages                      │
   │  - context_cache                 │
   │  - kb_documents                  │
   └──────────────────────────────────┘
```

## Configuration

### brain.json Configuration

Located at `/config/brain.json`, this file controls all brain settings:

```json
{
  "llm": {
    "model": "gemini-pro",
    "temperature": 0.7,
    "topP": 0.9,
    "maxTokens": 2048,
    "streaming": false,
    "providers": {
      "gemini": { "enabled": true },
      "openai": { "enabled": false },
      "claude": { "enabled": false },
      "ollama": { "enabled": false }
    }
  },
  "context": {
    "maxHistoryMessages": 10,
    "cacheEnabled": true,
    "cacheTTL": 3600
  },
  "knowledgeBase": {
    "autoSeedOnStart": true,
    "seedDocuments": ["USER.md", "SOUL.md", "MEMORY.md"]
  },
  "security": {
    "encryptMessages": false,
    "rateLimitPerMinute": 30,
    "auditLogging": true
  }
}
```

### Environment Variables

Set up the following environment variables for LLM access:

```bash
# Google Gemini
export GOOGLE_API_KEY="your-gemini-api-key"

# OpenAI (optional)
export OPENAI_API_KEY="your-openai-key"

# Anthropic Claude (optional)
export ANTHROPIC_API_KEY="your-anthropic-key"

# Ollama (local)
export OLLAMA_BASE_URL="http://localhost:11434"
```

## LLM Model Selection

### Gemini (Recommended)
- **Cost**: Very low (~0.50 per 1M tokens)
- **Speed**: Fast
- **Quality**: Good
- **Setup**: Just set `GOOGLE_API_KEY`

### OpenAI (GPT-4/3.5)
- **Cost**: Higher ($0.03-$0.06 per 1K tokens)
- **Speed**: Fast
- **Quality**: Excellent
- **Setup**: Set `OPENAI_API_KEY`

### Claude (Anthropic)
- **Cost**: Medium ($0.008-$0.024 per 1K tokens)
- **Speed**: Moderate
- **Quality**: Excellent
- **Setup**: Set `ANTHROPIC_API_KEY`

### Ollama (Local)
- **Cost**: Free (local)
- **Speed**: Depends on hardware
- **Quality**: Variable
- **Setup**: Install Ollama, run `ollama serve`

## Knowledge Base Seeding

On first start, the brain automatically seeds the knowledge base with:

1. **USER.md** - User identity and profile
2. **SOUL.md** - AI personality and values
3. **MEMORY.md** - Long-term memories and lessons learned

These documents are:
- Parsed into semantic chunks
- Converted to embeddings
- Stored in the SQLite database
- Used for semantic search in conversations

### Manual Seeding

To add custom documents:

```bash
curl -X POST http://localhost:4500/api/v1/brain/knowledge-base \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "source": "documentation",
    "title": "Project Overview",
    "content": "Your content here..."
  }'
```

## API Reference

### POST /api/v1/brain/chat
Start or continue a conversation with context-aware AI.

**Request:**
```json
{
  "message": "What is my name?",
  "conversationId": "conv_abc123",
  "model": "gemini-pro",
  "temperature": 0.7
}
```

**Response:**
```json
{
  "response": "Your name is Omri...",
  "conversationId": "conv_abc123",
  "tokensUsed": 145,
  "contextUsed": {
    "userProfile": true,
    "persona": true,
    "memory": 5,
    "documents": 2
  }
}
```

### GET /api/v1/brain/conversations
List all conversations.

**Response:**
```json
[
  {
    "id": "conv_abc123",
    "userId": "usr_xyz",
    "aiModel": "gemini-pro",
    "createdAt": "2026-02-27T10:30:00Z",
    "messageCount": 5,
    "lastMessageAt": "2026-02-27T10:45:00Z"
  }
]
```

### GET /api/v1/brain/conversations/:id
Get conversation with full history.

**Response:**
```json
{
  "conversation": { ... },
  "messages": [
    {
      "id": "msg_123",
      "role": "user",
      "content": "Hello",
      "createdAt": "2026-02-27T10:30:00Z"
    },
    {
      "id": "msg_124",
      "role": "assistant",
      "content": "Hi there!",
      "createdAt": "2026-02-27T10:30:05Z"
    }
  ]
}
```

### POST /api/v1/brain/knowledge-base
Add document to knowledge base.

**Request:**
```json
{
  "source": "documentation",
  "title": "My Project",
  "content": "Documentation content..."
}
```

**Response:**
```json
{
  "id": "kbdoc_123",
  "tokensProcessed": 250,
  "documentsCreated": 1
}
```

### GET /api/v1/brain/knowledge-base
List all KB documents.

**Response:**
```json
[
  {
    "id": "kbdoc_123",
    "source": "user-profile",
    "title": "USER.md",
    "createdAt": "2026-02-27T10:00:00Z"
  }
]
```

### GET /api/v1/brain/context
Get current assembled context.

**Response:**
```json
{
  "user": {
    "name": "Omri",
    "profile": { ... }
  },
  "persona": {
    "name": "Jarvis",
    "persona": { ... }
  },
  "memory": {
    "memories": [ ... ]
  },
  "recentMessages": [ ... ],
  "systemPrompt": "You are Jarvis..."
}
```

## Performance & Optimization

### Context Caching
- Enabled by default (1-hour TTL)
- Reduces database queries
- Improves response time by ~30%

### Database Indexing
- Conversations indexed by user_id
- Messages indexed by conversation_id
- Context cache indexed by key and expiry

### Token Counting
- Estimated at ~4 characters per token
- Used for billing and monitoring
- Accurate token counts from LLM responses

## Security & Privacy

### Message Encryption
- Currently disabled (can be enabled in config)
- All database connections encrypted

### Private Messages
- Mark messages as private to exclude from future context
- Useful for sensitive information

### Audit Logging
- All brain operations logged
- Actions: brain_chat, kb_document_added, brain_context_query
- Includes: timestamp, requester, resource, IP

### Rate Limiting
- Default: 30 requests/minute
- Protects against abuse
- Configurable per environment

## Troubleshooting

### Issue: "No API key configured"
**Solution**: Set the appropriate environment variable for your LLM provider.

```bash
export GOOGLE_API_KEY="your-key"
# or
export OPENAI_API_KEY="your-key"
```

### Issue: Slow response times
**Solution**: Check context caching is enabled and verify database indexes.

```javascript
// In brain.json
"context": {
  "cacheEnabled": true,
  "cacheTTL": 3600
}
```

### Issue: Knowledge base not seeding
**Solution**: Ensure USER.md, SOUL.md, and MEMORY.md exist in the workspace root.

```bash
ls -la ~/USER.md ~/SOUL.md ~/MEMORY.md
```

### Issue: Conversation history too long
**Solution**: Reduce maxHistoryMessages in brain.json:

```json
"context": {
  "maxHistoryMessages": 5
}
```

## Testing

Run the brain test suite:

```bash
cd /projects/MyApi
npm test -- tests/test-phase8-brain.js
```

Expected output:
```
✓ Create conversation
✓ Get conversations list
✓ Get conversation history
✓ Continue conversation
✓ Get context
✓ Add KB document
✓ Get KB documents
✓ Delete KB document
✓ Handle missing message field
✓ Get context with conversation

Test Results:
Passed: 10
Failed: 0
Total: 10
```

## Example Conversations

### Example 1: Personalized Response
```
User: "What should I do this weekend?"

Context loaded:
- User profile: Name, interests, timezone
- Persona: Helpful, proactive
- Memory: Previous weekend activities
- Documents: User preferences

Response: "Based on your interest in hiking and given the weather 
forecast for your area, I'd recommend exploring the new trail 
at Mount Wilson. You mentioned you wanted to try geocaching, 
and there are several caches along that route!"
```

### Example 2: Contextual Memory
```
User: "Remind me why I was working on that project"

Context loaded:
- Conversation history: Previous discussion about project
- Memory: Project goals and motivation
- Documents: Project documentation

Response: "You started this project to improve your team's 
deployment process. The goal was to reduce deployment time from 
2 hours to 15 minutes, which would save about 4-5 hours per week."
```

## Advanced Configuration

### Custom System Prompt
Modify the system prompt in context-engine.js:

```javascript
_buildSystemPrompt(userProfile, persona, memory) {
  // Customize the prompt construction
}
```

### Alternative Embeddings
Use real embeddings instead of simple hashing:

```javascript
// In knowledge-base.js, replace _generateEmbedding:
async _generateEmbedding(text) {
  // Call OpenAI embeddings API
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}
```

### Conversation Persistence
Export conversations:

```bash
curl -X GET "http://localhost:4500/api/v1/brain/conversations" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.' > conversations.json
```

## Database Schema

### conversations
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT
);
```

### messages
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding_vector TEXT,
  created_at TEXT NOT NULL,
  tokens_used INTEGER,
  private INTEGER DEFAULT 0
);
```

### kb_documents
```sql
CREATE TABLE kb_documents (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding_vector TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);
```

### context_cache
```sql
CREATE TABLE context_cache (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  ttl INTEGER,
  created_at TEXT NOT NULL,
  expires_at TEXT
);
```

## Next Steps

1. **Deploy**: Push to production with proper API keys
2. **Monitor**: Track token usage and response times
3. **Iterate**: Gather user feedback and optimize prompts
4. **Scale**: Add more documents to knowledge base
5. **Integrate**: Connect to external tools and APIs

For more information, see the main [README.md](../README.md).
