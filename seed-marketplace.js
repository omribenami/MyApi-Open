const { Pool } = require('pg');
const crypto = require('crypto');

const PG_URL = process.env.DATABASE_URL;
if (!PG_URL) { console.error('DATABASE_URL env var required'); process.exit(1); }
const pool = new Pool({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });

const now = new Date().toISOString();
const id = () => String(Math.floor(Math.random() * 900000) + 100000);

const skills = [
  // ── Anthropic ──────────────────────────────────────────────────────────────
  {
    name: 'Claude Chat',
    description: 'Send messages to Claude and receive intelligent, context-aware responses. Supports system prompts, multi-turn conversations, and streaming.',
    version: '1.0.0', author: 'Anthropic', category: 'ai',
    provider: 'anthropic', official: true,
    tags: ['anthropic', 'claude', 'chat', 'llm', 'ai'],
    script: `---
name: claude-chat
description: Send messages to Anthropic Claude and receive intelligent responses.
---

# Claude Chat

Calls the Anthropic Messages API to generate a response from Claude.

## Parameters
- \`model\`: Claude model to use (default: claude-opus-4-5)
- \`system\`: Optional system prompt
- \`messages\`: Array of { role, content } objects
- \`max_tokens\`: Maximum tokens in response (default: 1024)

## Usage
\`\`\`json
{
  "model": "claude-opus-4-5",
  "system": "You are a helpful assistant.",
  "messages": [{ "role": "user", "content": "Hello!" }],
  "max_tokens": 1024
}
\`\`\`
`,
  },
  {
    name: 'Claude Vision',
    description: 'Analyze images using Claude\'s multimodal capabilities. Pass image URLs or base64 data to extract information, describe scenes, read text, and more.',
    version: '1.0.0', author: 'Anthropic', category: 'ai',
    provider: 'anthropic', official: true,
    tags: ['anthropic', 'claude', 'vision', 'multimodal', 'image'],
    script: `---
name: claude-vision
description: Analyze images with Anthropic Claude's multimodal capabilities.
---

# Claude Vision

Uses the Anthropic Messages API with image content blocks to analyze images.

## Parameters
- \`image_url\`: Public image URL to analyze
- \`prompt\`: Question or instruction about the image
- \`model\`: Model to use (default: claude-opus-4-5)

## Usage
\`\`\`json
{
  "image_url": "https://example.com/image.png",
  "prompt": "What is in this image?"
}
\`\`\`
`,
  },
  {
    name: 'Claude Tool Use',
    description: 'Give Claude access to custom tools and function calls. Claude will decide when and how to use them to complete complex multi-step tasks.',
    version: '1.0.0', author: 'Anthropic', category: 'ai',
    provider: 'anthropic', official: true,
    tags: ['anthropic', 'claude', 'tools', 'function-calling', 'agents'],
    script: `---
name: claude-tool-use
description: Enable Claude to call custom tools and functions autonomously.
---

# Claude Tool Use

Implements Anthropic's tool use (function calling) API for agentic workflows.

## Parameters
- \`tools\`: Array of tool definitions with name, description, and input_schema
- \`messages\`: Conversation history
- \`model\`: Claude model (default: claude-opus-4-5)

## Usage
Define tools and Claude will decide when to call them and parse the results.
`,
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  {
    name: 'GPT Chat Completion',
    description: 'Call OpenAI\'s GPT models for chat completions. Supports GPT-4o, GPT-4 Turbo, GPT-3.5, streaming, and JSON mode.',
    version: '1.0.0', author: 'OpenAI', category: 'ai',
    provider: 'openai', official: true,
    tags: ['openai', 'gpt', 'gpt-4o', 'chat', 'llm'],
    script: `---
name: gpt-chat-completion
description: Call OpenAI GPT models for chat completions.
---

# GPT Chat Completion

Calls the OpenAI Chat Completions API (/v1/chat/completions).

## Parameters
- \`model\`: OpenAI model (e.g. gpt-4o, gpt-4-turbo, gpt-3.5-turbo)
- \`messages\`: Array of { role, content } objects
- \`temperature\`: Sampling temperature (0–2)
- \`response_format\`: Set to { type: "json_object" } for JSON mode

## Usage
\`\`\`json
{
  "model": "gpt-4o",
  "messages": [{ "role": "user", "content": "Explain quantum computing." }]
}
\`\`\`
`,
  },
  {
    name: 'GPT Function Calling',
    description: 'Use OpenAI\'s function calling to let GPT-4o invoke structured tools. Ideal for building agents that interact with external APIs.',
    version: '1.0.0', author: 'OpenAI', category: 'ai',
    provider: 'openai', official: true,
    tags: ['openai', 'gpt-4o', 'function-calling', 'tools', 'agents'],
    script: `---
name: gpt-function-calling
description: Let GPT-4o call structured tools and functions.
---

# GPT Function Calling

Uses OpenAI's tool_choice and tools parameters for structured function calling.

## Parameters
- \`model\`: OpenAI model (gpt-4o recommended)
- \`tools\`: Array of tool definitions
- \`messages\`: Conversation history
- \`tool_choice\`: "auto", "none", or specific tool name
`,
  },
  {
    name: 'DALL·E Image Generation',
    description: 'Generate high-quality images from text prompts using OpenAI\'s DALL·E 3. Supports 1024×1024, 1792×1024, and 1024×1792 resolutions.',
    version: '1.0.0', author: 'OpenAI', category: 'ai',
    provider: 'openai', official: true,
    tags: ['openai', 'dall-e', 'image-generation', 'creative', 'vision'],
    script: `---
name: dalle-image-generation
description: Generate images from text prompts using OpenAI DALL·E 3.
---

# DALL·E Image Generation

Calls the OpenAI Images API (/v1/images/generations) with DALL·E 3.

## Parameters
- \`prompt\`: Text description of the image to generate
- \`size\`: "1024x1024" | "1792x1024" | "1024x1792"
- \`quality\`: "standard" | "hd"
- \`n\`: Number of images (1 for DALL·E 3)
`,
  },
  {
    name: 'Whisper Transcription',
    description: 'Transcribe or translate audio files using OpenAI Whisper. Supports MP3, MP4, WAV, FLAC and more. Returns timestamps and word-level data.',
    version: '1.0.0', author: 'OpenAI', category: 'ai',
    provider: 'openai', official: true,
    tags: ['openai', 'whisper', 'transcription', 'audio', 'speech-to-text'],
    script: `---
name: whisper-transcription
description: Transcribe audio files to text using OpenAI Whisper.
---

# Whisper Transcription

Calls OpenAI Audio API (/v1/audio/transcriptions) with Whisper.

## Parameters
- \`file\`: Audio file path or URL (MP3, MP4, WAV, FLAC, M4A)
- \`language\`: ISO-639-1 language code (optional, auto-detected)
- \`response_format\`: "json" | "text" | "srt" | "vtt" | "verbose_json"
- \`timestamp_granularities\`: ["word", "segment"] for verbose_json
`,
  },
  {
    name: 'OpenAI Embeddings',
    description: 'Generate vector embeddings for text using text-embedding-3-large or text-embedding-3-small. Use for semantic search, clustering, and RAG pipelines.',
    version: '1.0.0', author: 'OpenAI', category: 'ai',
    provider: 'openai', official: true,
    tags: ['openai', 'embeddings', 'vector', 'semantic-search', 'rag'],
    script: `---
name: openai-embeddings
description: Generate vector embeddings using OpenAI text-embedding models.
---

# OpenAI Embeddings

Calls /v1/embeddings to generate dense vector representations.

## Parameters
- \`input\`: String or array of strings to embed
- \`model\`: "text-embedding-3-large" | "text-embedding-3-small" | "text-embedding-ada-002"
- \`dimensions\`: Output dimensions (for text-embedding-3 models)
`,
  },

  // ── Google ──────────────────────────────────────────────────────────────────
  {
    name: 'Gemini Chat',
    description: 'Chat with Google Gemini 2.0 Flash or Gemini 1.5 Pro. Supports long context windows (up to 1M tokens), multi-turn conversations, and system instructions.',
    version: '1.0.0', author: 'Google', category: 'ai',
    provider: 'google', official: true,
    tags: ['google', 'gemini', 'chat', 'llm', 'ai'],
    script: `---
name: gemini-chat
description: Chat with Google Gemini models via the Gemini API.
---

# Gemini Chat

Calls the Google Gemini generateContent API.

## Parameters
- \`model\`: Gemini model (gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash)
- \`contents\`: Array of { role, parts: [{ text }] }
- \`systemInstruction\`: Optional system prompt
- \`generationConfig\`: temperature, maxOutputTokens, topP, etc.
`,
  },
  {
    name: 'Gemini Vision',
    description: 'Analyze images and video with Google Gemini\'s multimodal understanding. Supports inline images, YouTube URLs, and Google Drive files.',
    version: '1.0.0', author: 'Google', category: 'ai',
    provider: 'google', official: true,
    tags: ['google', 'gemini', 'vision', 'multimodal', 'video'],
    script: `---
name: gemini-vision
description: Analyze images and video with Google Gemini multimodal API.
---

# Gemini Vision

Uses Gemini's multimodal capabilities with inline or URI-based media.

## Parameters
- \`media_url\`: Image URL, YouTube link, or Google Drive URL
- \`prompt\`: Question or instruction about the media
- \`model\`: gemini-2.0-flash or gemini-1.5-pro (for video)
`,
  },
  {
    name: 'Google Search Grounding',
    description: 'Give Gemini real-time access to Google Search results. Answers are grounded in up-to-date web data with citations and source links.',
    version: '1.0.0', author: 'Google', category: 'ai',
    provider: 'google', official: true,
    tags: ['google', 'gemini', 'search', 'grounding', 'real-time'],
    script: `---
name: google-search-grounding
description: Ground Gemini responses with live Google Search results.
---

# Google Search Grounding

Enables the google_search tool in Gemini for real-time web-grounded answers.

## Parameters
- \`query\`: The question or topic to research
- \`model\`: gemini-2.0-flash (recommended for speed)
- Returns grounded answer with cited web sources
`,
  },
  {
    name: 'Vertex AI Code Generation',
    description: 'Generate, explain, and debug code using Google\'s Codey models on Vertex AI. Supports 20+ programming languages.',
    version: '1.0.0', author: 'Google', category: 'ai',
    provider: 'google', official: true,
    tags: ['google', 'vertex-ai', 'code', 'codey', 'programming'],
    script: `---
name: vertex-ai-code
description: Generate and explain code using Google Codey on Vertex AI.
---

# Vertex AI Code Generation

Calls Google Cloud Vertex AI code-bison or code-gecko models.

## Parameters
- \`prompt\`: Code generation prompt or code to explain/debug
- \`model\`: "code-bison" | "code-gecko" | "gemini-2.0-flash" (code tasks)
- \`prefix\`: Optional code prefix for completion mode
`,
  },

  // ── Meta ────────────────────────────────────────────────────────────────────
  {
    name: 'Llama 3 Chat',
    description: 'Run Meta Llama 3.3 (70B) via any compatible API endpoint. Open-source LLM with strong reasoning, coding, and multilingual capabilities.',
    version: '1.0.0', author: 'Meta', category: 'ai',
    provider: 'meta', official: true,
    tags: ['meta', 'llama', 'open-source', 'llm', 'chat'],
    script: `---
name: llama3-chat
description: Chat with Meta Llama 3 via a compatible OpenAI-format API.
---

# Llama 3 Chat

Calls any OpenAI-compatible endpoint serving Meta Llama 3 models.
Compatible with Groq, Together AI, Replicate, Ollama, and more.

## Parameters
- \`base_url\`: API endpoint (e.g. https://api.groq.com/openai/v1)
- \`model\`: e.g. "llama-3.3-70b-versatile" (Groq) or "meta-llama/Llama-3-70b-chat-hf"
- \`messages\`: Array of { role, content }
`,
  },

  // ── Mistral ─────────────────────────────────────────────────────────────────
  {
    name: 'Mistral Chat',
    description: 'Chat with Mistral AI\'s models including Mistral Large, Mistral Small, and Codestral. Excellent for coding, reasoning, and multilingual tasks.',
    version: '1.0.0', author: 'Mistral AI', category: 'ai',
    provider: 'mistral', official: true,
    tags: ['mistral', 'llm', 'chat', 'coding', 'open-source'],
    script: `---
name: mistral-chat
description: Chat with Mistral AI models via the Mistral API.
---

# Mistral Chat

Calls the Mistral API (/v1/chat/completions) — OpenAI-compatible format.

## Parameters
- \`model\`: "mistral-large-latest" | "mistral-small-latest" | "codestral-latest"
- \`messages\`: Array of { role, content }
- \`temperature\`: Sampling temperature
- \`safe_prompt\`: Enable safe mode guardrails
`,
  },

  // ── xAI ─────────────────────────────────────────────────────────────────────
  {
    name: 'Grok Chat',
    description: 'Chat with xAI\'s Grok models. Grok has real-time access to X (Twitter) data and excels at current events, humor, and technical reasoning.',
    version: '1.0.0', author: 'xAI', category: 'ai',
    provider: 'xai', official: true,
    tags: ['xai', 'grok', 'llm', 'real-time', 'x-twitter'],
    script: `---
name: grok-chat
description: Chat with xAI Grok models via the xAI API.
---

# Grok Chat

Calls the xAI API (/v1/chat/completions) — OpenAI-compatible format.

## Parameters
- \`model\`: "grok-3" | "grok-3-mini" | "grok-2"
- \`messages\`: Array of { role, content }
- \`temperature\`: Sampling temperature (0–2)
- \`stream\`: Enable streaming responses
`,
  },

  // ── Cohere ──────────────────────────────────────────────────────────────────
  {
    name: 'Cohere Command',
    description: 'Generate text and complete tasks using Cohere Command R+. Optimized for RAG pipelines, grounded generation, and enterprise search.',
    version: '1.0.0', author: 'Cohere', category: 'ai',
    provider: 'cohere', official: true,
    tags: ['cohere', 'command', 'rag', 'enterprise', 'llm'],
    script: `---
name: cohere-command
description: Generate text with Cohere Command R+ via the Cohere API.
---

# Cohere Command

Calls the Cohere Chat API with optional document grounding for RAG.

## Parameters
- \`model\`: "command-r-plus" | "command-r" | "command-light"
- \`message\`: The user message
- \`documents\`: Optional array of { title, snippet } for RAG grounding
- \`preamble\`: Optional system prompt / preamble
`,
  },
];

const listings = skills.map(s => ({
  type: 'skill',
  title: s.name,
  description: s.description,
  tags: JSON.stringify(s.tags),
  price: 0,
  status: 'active',
  avg_rating: (4.2 + Math.random() * 0.7).toFixed(1),
  rating_count: Math.floor(Math.random() * 200) + 20,
  install_count: Math.floor(Math.random() * 2000) + 100,
  provider: s.provider,
  official: true,
}));

async function main() {
  const client = await pool.connect();

  console.log('Inserting skills...');
  const skillIds = [];
  for (const s of skills) {
    const sid = String(Math.floor(Math.random() * 9000000) + 1000000);
    await client.query(`
      INSERT INTO skills (id, name, description, version, author, category, script_content, active, created_at, updated_at, owner_id, license, published_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9,'system','MIT',$10)
    `, [sid, s.name, s.description, s.version, s.author, s.category, s.script, now, now, now]);
    skillIds.push(sid);
    console.log(`  + skill: ${s.name}`);
  }

  console.log('\nInserting marketplace listings...');
  for (let i = 0; i < listings.length; i++) {
    const l = listings[i];
    const lid = String(Math.floor(Math.random() * 9000000) + 1000000);
    await client.query(`
      INSERT INTO marketplace_listings
        (id, owner_id, type, title, description, content, tags, price, status, avg_rating, rating_count, install_count, created_at, updated_at, provider, official)
      VALUES ($1,'system',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [
      lid, l.type, l.title, l.description,
      JSON.stringify({ skill_id: skillIds[i] }),
      l.tags, l.price, l.status,
      l.avg_rating, l.rating_count, l.install_count,
      now, now, l.provider, l.official
    ]);
    console.log(`  + listing: ${l.title}`);
  }

  client.release();
  await pool.end();
  console.log(`\nDone. ${skills.length} skills + ${listings.length} listings created.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
