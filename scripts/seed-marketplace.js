#!/usr/bin/env node
/**
 * Marketplace Seed Script — AI Company Tools
 * Clears existing listings and populates with real AI provider APIs & skills.
 *
 * Usage: node scripts/seed-marketplace.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Database = require('better-sqlite3');
const DB_PATH = process.env.DB_PATH || '/opt/MyApi/data/myapi.db';

const db = new Database(DB_PATH);
const now = new Date().toISOString();

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

const listings = [

  // ─── ANTHROPIC ────────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'Anthropic', official: 1,
    title: 'Claude API',
    description: 'Access Anthropic\'s Claude models for text generation, analysis, coding, and reasoning. Includes Claude 3.5 Sonnet, Claude 3 Opus, and Claude 3 Haiku.',
    tags: 'anthropic,claude,llm,ai,text-generation,reasoning',
    price: 'paid',
    content: {
      service_name: 'anthropic_claude',
      label: 'Anthropic Claude',
      endpoint: 'https://api.anthropic.com/v1',
      auth_type: 'bearer',
      documentation_url: 'https://docs.anthropic.com/en/api',
      category: 'ai',
      methods: [
        { method_name: 'messages', http_method: 'POST', endpoint: 'https://api.anthropic.com/v1/messages', description: 'Send a message to Claude and receive a response', parameters: { model: 'claude-sonnet-4-5', max_tokens: 1024, messages: [] } },
        { method_name: 'count_tokens', http_method: 'POST', endpoint: 'https://api.anthropic.com/v1/messages/count_tokens', description: 'Count the number of tokens in a message' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'skill', provider: 'Anthropic', official: 1,
    title: 'Claude Code Assistant',
    description: 'AI-powered coding assistant using Claude. Reviews code, suggests improvements, explains logic, and generates code snippets in any language.',
    tags: 'anthropic,claude,coding,code-review,ai-assistant',
    price: 'free',
    content: {
      skill_name: 'Claude Code Assistant',
      version: '1.0.0',
      category: 'coding',
      author: 'Anthropic',
      repo_url: 'https://github.com/anthropics/anthropic-sdk-python',
      description: 'Code review and generation using Claude API',
      script_content: `# Claude Code Assistant
# Requires: ANTHROPIC_API_KEY environment variable

import anthropic

client = anthropic.Anthropic()

def review_code(code: str, language: str = "python") -> str:
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": f"Review this {language} code and suggest improvements:\\n\\n{code}"}]
    )
    return message.content[0].text

def generate_code(prompt: str, language: str = "python") -> str:
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2048,
        messages=[{"role": "user", "content": f"Write {language} code for: {prompt}. Return only the code."}]
    )
    return message.content[0].text
`,
    },
  },

  // ─── OPENAI ────────────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'OpenAI', official: 1,
    title: 'OpenAI Chat API',
    description: 'Access GPT-4o, GPT-4 Turbo, and GPT-3.5 Turbo for chat completions, function calling, and multi-modal inputs including images.',
    tags: 'openai,gpt4,chatgpt,llm,ai,text-generation',
    price: 'paid',
    content: {
      service_name: 'openai_chat',
      label: 'OpenAI Chat',
      endpoint: 'https://api.openai.com/v1',
      auth_type: 'bearer',
      documentation_url: 'https://platform.openai.com/docs/api-reference',
      category: 'ai',
      methods: [
        { method_name: 'chat_completions', http_method: 'POST', endpoint: 'https://api.openai.com/v1/chat/completions', description: 'Create a chat completion with GPT-4o or GPT-3.5', parameters: { model: 'gpt-4o', messages: [], temperature: 1 } },
        { method_name: 'list_models', http_method: 'GET', endpoint: 'https://api.openai.com/v1/models', description: 'List all available OpenAI models' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'OpenAI', official: 1,
    title: 'OpenAI DALL-E 3',
    description: 'Generate and edit images with DALL-E 3. Create stunning, photorealistic images from text prompts with precise adherence to instructions.',
    tags: 'openai,dall-e,image-generation,ai,creative',
    price: 'paid',
    content: {
      service_name: 'openai_dalle',
      label: 'OpenAI DALL-E 3',
      endpoint: 'https://api.openai.com/v1/images',
      auth_type: 'bearer',
      documentation_url: 'https://platform.openai.com/docs/guides/images',
      category: 'ai',
      methods: [
        { method_name: 'generate', http_method: 'POST', endpoint: 'https://api.openai.com/v1/images/generations', description: 'Generate images from a text prompt', parameters: { model: 'dall-e-3', prompt: '', n: 1, size: '1024x1024' } },
        { method_name: 'edit', http_method: 'POST', endpoint: 'https://api.openai.com/v1/images/edits', description: 'Edit an existing image based on a prompt' },
        { method_name: 'variation', http_method: 'POST', endpoint: 'https://api.openai.com/v1/images/variations', description: 'Create variations of an existing image' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'OpenAI', official: 1,
    title: 'OpenAI Whisper (Speech-to-Text)',
    description: 'Transcribe or translate audio to text using Whisper. Supports 57 languages, timestamps, and word-level timestamps.',
    tags: 'openai,whisper,speech-to-text,transcription,audio',
    price: 'paid',
    content: {
      service_name: 'openai_whisper',
      label: 'OpenAI Whisper',
      endpoint: 'https://api.openai.com/v1/audio',
      auth_type: 'bearer',
      documentation_url: 'https://platform.openai.com/docs/guides/speech-to-text',
      category: 'ai',
      methods: [
        { method_name: 'transcribe', http_method: 'POST', endpoint: 'https://api.openai.com/v1/audio/transcriptions', description: 'Transcribe audio into text', parameters: { model: 'whisper-1', language: 'en' } },
        { method_name: 'translate', http_method: 'POST', endpoint: 'https://api.openai.com/v1/audio/translations', description: 'Translate audio into English text' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'OpenAI', official: 1,
    title: 'OpenAI Embeddings',
    description: 'Convert text into high-dimensional vector embeddings for semantic search, clustering, classification, and RAG pipelines.',
    tags: 'openai,embeddings,vector,semantic-search,rag',
    price: 'paid',
    content: {
      service_name: 'openai_embeddings',
      label: 'OpenAI Embeddings',
      endpoint: 'https://api.openai.com/v1/embeddings',
      auth_type: 'bearer',
      documentation_url: 'https://platform.openai.com/docs/guides/embeddings',
      category: 'ai',
      methods: [
        { method_name: 'create', http_method: 'POST', endpoint: 'https://api.openai.com/v1/embeddings', description: 'Create embeddings for text', parameters: { model: 'text-embedding-3-large', input: '' } },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'OpenAI', official: 1,
    title: 'OpenAI Text-to-Speech',
    description: 'Convert text into natural-sounding speech with 6 built-in voices. Supports multiple formats and real-time streaming.',
    tags: 'openai,tts,text-to-speech,audio,voice',
    price: 'paid',
    content: {
      service_name: 'openai_tts',
      label: 'OpenAI TTS',
      endpoint: 'https://api.openai.com/v1/audio/speech',
      auth_type: 'bearer',
      documentation_url: 'https://platform.openai.com/docs/guides/text-to-speech',
      category: 'ai',
      methods: [
        { method_name: 'synthesize', http_method: 'POST', endpoint: 'https://api.openai.com/v1/audio/speech', description: 'Convert text to speech audio', parameters: { model: 'tts-1-hd', input: '', voice: 'alloy' } },
      ],
    },
  },

  // ─── GOOGLE ────────────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'Google', official: 1,
    title: 'Google Gemini API',
    description: 'Access Google\'s most capable AI models — Gemini 1.5 Pro and Flash — for text, vision, audio, and code tasks with a 2M token context window.',
    tags: 'google,gemini,llm,ai,multimodal,vision',
    price: 'paid',
    content: {
      service_name: 'google_gemini',
      label: 'Google Gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      auth_type: 'api_key',
      documentation_url: 'https://ai.google.dev/api',
      category: 'ai',
      methods: [
        { method_name: 'generate_content', http_method: 'POST', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent', description: 'Generate content with Gemini 1.5 Pro', parameters: { contents: [] } },
        { method_name: 'generate_content_flash', http_method: 'POST', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', description: 'Generate content with Gemini 1.5 Flash (faster, cheaper)' },
        { method_name: 'list_models', http_method: 'GET', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models', description: 'List all available Gemini models' },
        { method_name: 'embed_content', http_method: 'POST', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent', description: 'Generate text embeddings' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'Google', official: 1,
    title: 'Google Cloud Vision API',
    description: 'Detect objects, faces, text (OCR), landmarks, logos, and explicit content in images using Google\'s pre-trained machine learning models.',
    tags: 'google,vision,ocr,image-recognition,cloud',
    price: 'paid',
    content: {
      service_name: 'google_vision',
      label: 'Google Cloud Vision',
      endpoint: 'https://vision.googleapis.com/v1',
      auth_type: 'api_key',
      documentation_url: 'https://cloud.google.com/vision/docs',
      category: 'ai',
      methods: [
        { method_name: 'annotate', http_method: 'POST', endpoint: 'https://vision.googleapis.com/v1/images:annotate', description: 'Analyze image content — labels, OCR, faces, objects', parameters: { requests: [] } },
        { method_name: 'async_annotate', http_method: 'POST', endpoint: 'https://vision.googleapis.com/v1/images:asyncBatchAnnotate', description: 'Async batch image annotation for large files' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'Google', official: 1,
    title: 'Google Cloud Translation API',
    description: 'Translate text between 100+ languages instantly. Supports automatic language detection and custom translation models via AutoML.',
    tags: 'google,translation,language,nlp,cloud',
    price: 'paid',
    content: {
      service_name: 'google_translate',
      label: 'Google Translate',
      endpoint: 'https://translation.googleapis.com/language/translate/v2',
      auth_type: 'api_key',
      documentation_url: 'https://cloud.google.com/translate/docs',
      category: 'ai',
      methods: [
        { method_name: 'translate', http_method: 'POST', endpoint: 'https://translation.googleapis.com/language/translate/v2', description: 'Translate text to a target language', parameters: { q: '', target: 'en' } },
        { method_name: 'detect', http_method: 'POST', endpoint: 'https://translation.googleapis.com/language/translate/v2/detect', description: 'Detect the language of text' },
        { method_name: 'languages', http_method: 'GET', endpoint: 'https://translation.googleapis.com/language/translate/v2/languages', description: 'List supported languages' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'Google', official: 1,
    title: 'Google Cloud Speech-to-Text',
    description: 'Transcribe audio to text with 125+ language support, speaker diarization, automatic punctuation, and real-time streaming.',
    tags: 'google,speech-to-text,transcription,audio,cloud',
    price: 'paid',
    content: {
      service_name: 'google_speech',
      label: 'Google Speech-to-Text',
      endpoint: 'https://speech.googleapis.com/v1',
      auth_type: 'bearer',
      documentation_url: 'https://cloud.google.com/speech-to-text/docs',
      category: 'ai',
      methods: [
        { method_name: 'recognize', http_method: 'POST', endpoint: 'https://speech.googleapis.com/v1/speech:recognize', description: 'Transcribe short audio (< 1 min)', parameters: { config: { languageCode: 'en-US' }, audio: {} } },
        { method_name: 'long_running_recognize', http_method: 'POST', endpoint: 'https://speech.googleapis.com/v1/speech:longrunningrecognize', description: 'Transcribe long audio files asynchronously' },
      ],
    },
  },

  // ─── MICROSOFT / AZURE ────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'Microsoft', official: 1,
    title: 'Azure OpenAI Service',
    description: 'Deploy OpenAI models (GPT-4o, DALL-E 3, Whisper, Embeddings) on Azure infrastructure with enterprise security, compliance, and private networking.',
    tags: 'microsoft,azure,openai,gpt4,enterprise,llm',
    price: 'paid',
    content: {
      service_name: 'azure_openai',
      label: 'Azure OpenAI',
      endpoint: 'https://{resource}.openai.azure.com/openai/deployments',
      auth_type: 'api_key',
      documentation_url: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
      category: 'ai',
      methods: [
        { method_name: 'chat_completions', http_method: 'POST', endpoint: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=2024-02-01', description: 'Chat completion via Azure-hosted GPT-4o' },
        { method_name: 'embeddings', http_method: 'POST', endpoint: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}/embeddings?api-version=2024-02-01', description: 'Generate embeddings via Azure' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'Microsoft', official: 1,
    title: 'Azure AI Language',
    description: 'NLP tasks including sentiment analysis, key phrase extraction, named entity recognition, PII detection, language detection, and summarization.',
    tags: 'microsoft,azure,nlp,sentiment,ner,text-analytics',
    price: 'paid',
    content: {
      service_name: 'azure_language',
      label: 'Azure AI Language',
      endpoint: 'https://{endpoint}.cognitiveservices.azure.com/language',
      auth_type: 'api_key',
      documentation_url: 'https://learn.microsoft.com/en-us/azure/ai-services/language-service/',
      category: 'ai',
      methods: [
        { method_name: 'sentiment', http_method: 'POST', endpoint: 'https://{endpoint}.cognitiveservices.azure.com/language/:analyze-text?api-version=2023-04-01', description: 'Analyze sentiment — positive, negative, mixed, neutral' },
        { method_name: 'key_phrases', http_method: 'POST', endpoint: 'https://{endpoint}.cognitiveservices.azure.com/language/:analyze-text?api-version=2023-04-01', description: 'Extract key phrases from text' },
        { method_name: 'entities', http_method: 'POST', endpoint: 'https://{endpoint}.cognitiveservices.azure.com/language/:analyze-text?api-version=2023-04-01', description: 'Recognize named entities (persons, places, orgs)' },
        { method_name: 'pii_detection', http_method: 'POST', endpoint: 'https://{endpoint}.cognitiveservices.azure.com/language/:analyze-text?api-version=2023-04-01', description: 'Detect and redact personally identifiable information' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'Microsoft', official: 1,
    title: 'Bing Search API',
    description: 'Web, image, video, and news search powered by Bing. Get relevant search results with ranking, snippets, and rich entity data.',
    tags: 'microsoft,bing,search,web,news',
    price: 'paid',
    content: {
      service_name: 'bing_search',
      label: 'Bing Search',
      endpoint: 'https://api.bing.microsoft.com/v7.0',
      auth_type: 'api_key',
      documentation_url: 'https://learn.microsoft.com/en-us/bing/search-apis/',
      category: 'search',
      methods: [
        { method_name: 'web_search', http_method: 'GET', endpoint: 'https://api.bing.microsoft.com/v7.0/search', description: 'Search the web', parameters: { q: '', count: 10 } },
        { method_name: 'news_search', http_method: 'GET', endpoint: 'https://api.bing.microsoft.com/v7.0/news/search', description: 'Search news articles', parameters: { q: '', freshness: 'Day' } },
        { method_name: 'image_search', http_method: 'GET', endpoint: 'https://api.bing.microsoft.com/v7.0/images/search', description: 'Search images', parameters: { q: '' } },
      ],
    },
  },

  // ─── META ──────────────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'Meta', official: 1,
    title: 'Meta Llama API',
    description: 'Access Meta\'s open Llama models (Llama 3.1 405B, 70B, 8B) via Meta\'s hosted API for text generation, code, and reasoning tasks.',
    tags: 'meta,llama,llm,open-source,ai,text-generation',
    price: 'paid',
    content: {
      service_name: 'meta_llama',
      label: 'Meta Llama API',
      endpoint: 'https://api.llama.com/v1',
      auth_type: 'bearer',
      documentation_url: 'https://llama.developer.meta.com/docs',
      category: 'ai',
      methods: [
        { method_name: 'chat_completions', http_method: 'POST', endpoint: 'https://api.llama.com/v1/chat/completions', description: 'Chat with Llama 3.1 models', parameters: { model: 'Llama-3.1-70B-Instruct', messages: [] } },
      ],
    },
  },

  // ─── AMAZON / AWS ─────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'Amazon', official: 1,
    title: 'AWS Bedrock',
    description: 'Fully managed service to access foundation models from Anthropic, Meta, Mistral, Amazon Titan, and more via a single AWS API.',
    tags: 'aws,amazon,bedrock,claude,llama,llm,enterprise',
    price: 'paid',
    content: {
      service_name: 'aws_bedrock',
      label: 'AWS Bedrock',
      endpoint: 'https://bedrock-runtime.{region}.amazonaws.com',
      auth_type: 'aws_sigv4',
      documentation_url: 'https://docs.aws.amazon.com/bedrock/',
      category: 'ai',
      methods: [
        { method_name: 'invoke_model', http_method: 'POST', endpoint: 'https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/invoke', description: 'Invoke a foundation model (Claude, Llama, Titan, Mistral)' },
        { method_name: 'invoke_model_stream', http_method: 'POST', endpoint: 'https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/invoke-with-response-stream', description: 'Stream a foundation model response' },
      ],
    },
  },

  {
    owner_id: 'system', type: 'api', provider: 'Amazon', official: 1,
    title: 'Amazon Rekognition',
    description: 'Automate image and video analysis — detect objects, people, text, scenes, activities, and identify celebrities or inappropriate content.',
    tags: 'aws,amazon,rekognition,vision,image-recognition,video',
    price: 'paid',
    content: {
      service_name: 'aws_rekognition',
      label: 'Amazon Rekognition',
      endpoint: 'https://rekognition.{region}.amazonaws.com',
      auth_type: 'aws_sigv4',
      documentation_url: 'https://docs.aws.amazon.com/rekognition/',
      category: 'ai',
      methods: [
        { method_name: 'detect_labels', http_method: 'POST', endpoint: 'https://rekognition.{region}.amazonaws.com/', description: 'Detect labels (objects, scenes, concepts) in an image' },
        { method_name: 'detect_text', http_method: 'POST', endpoint: 'https://rekognition.{region}.amazonaws.com/', description: 'Detect and extract text from images' },
        { method_name: 'detect_faces', http_method: 'POST', endpoint: 'https://rekognition.{region}.amazonaws.com/', description: 'Detect faces and analyze attributes' },
      ],
    },
  },

  // ─── MISTRAL AI ───────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'Mistral AI', official: 1,
    title: 'Mistral AI API',
    description: 'Access Mistral Large, Mistral Small, and open-weight Mixtral models. Best-in-class performance for code, reasoning, and multilingual tasks.',
    tags: 'mistral,llm,ai,open-source,coding,french',
    price: 'paid',
    content: {
      service_name: 'mistral_ai',
      label: 'Mistral AI',
      endpoint: 'https://api.mistral.ai/v1',
      auth_type: 'bearer',
      documentation_url: 'https://docs.mistral.ai/',
      category: 'ai',
      methods: [
        { method_name: 'chat', http_method: 'POST', endpoint: 'https://api.mistral.ai/v1/chat/completions', description: 'Chat with Mistral Large or Mistral Small', parameters: { model: 'mistral-large-latest', messages: [] } },
        { method_name: 'embeddings', http_method: 'POST', endpoint: 'https://api.mistral.ai/v1/embeddings', description: 'Create embeddings with Mistral Embed', parameters: { model: 'mistral-embed', input: [] } },
        { method_name: 'list_models', http_method: 'GET', endpoint: 'https://api.mistral.ai/v1/models', description: 'List available Mistral models' },
      ],
    },
  },

  // ─── COHERE ───────────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'Cohere', official: 1,
    title: 'Cohere API',
    description: 'Enterprise-grade NLP — Command R+ for RAG and tool use, Embed v3 for semantic search, and Rerank for relevance scoring.',
    tags: 'cohere,llm,embeddings,rag,rerank,enterprise',
    price: 'paid',
    content: {
      service_name: 'cohere',
      label: 'Cohere',
      endpoint: 'https://api.cohere.com/v2',
      auth_type: 'bearer',
      documentation_url: 'https://docs.cohere.com',
      category: 'ai',
      methods: [
        { method_name: 'chat', http_method: 'POST', endpoint: 'https://api.cohere.com/v2/chat', description: 'Chat with Command R+ — optimized for RAG and tool use', parameters: { model: 'command-r-plus', messages: [] } },
        { method_name: 'embed', http_method: 'POST', endpoint: 'https://api.cohere.com/v2/embed', description: 'Generate multilingual embeddings for semantic search', parameters: { model: 'embed-english-v3.0', texts: [], input_type: 'search_document' } },
        { method_name: 'rerank', http_method: 'POST', endpoint: 'https://api.cohere.com/v2/rerank', description: 'Rerank documents by relevance to a query', parameters: { model: 'rerank-english-v3.0', query: '', documents: [] } },
      ],
    },
  },

  // ─── PERPLEXITY ───────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'Perplexity', official: 1,
    title: 'Perplexity Sonar API',
    description: 'Real-time web search + LLM in one API call. Get grounded, cited answers with live web access. Ideal for research and up-to-date information.',
    tags: 'perplexity,search,llm,real-time,web-search,citations',
    price: 'paid',
    content: {
      service_name: 'perplexity_sonar',
      label: 'Perplexity Sonar',
      endpoint: 'https://api.perplexity.ai',
      auth_type: 'bearer',
      documentation_url: 'https://docs.perplexity.ai',
      category: 'ai',
      methods: [
        { method_name: 'chat', http_method: 'POST', endpoint: 'https://api.perplexity.ai/chat/completions', description: 'Search the web and get a cited AI answer', parameters: { model: 'llama-3.1-sonar-large-128k-online', messages: [] } },
      ],
    },
  },

  // ─── ELEVENLABS ───────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'ElevenLabs', official: 1,
    title: 'ElevenLabs Text-to-Speech',
    description: 'Ultra-realistic AI voices with emotion, tone control, and voice cloning. Generate speech in 29 languages with < 300ms latency for streaming.',
    tags: 'elevenlabs,tts,voice,speech,audio,voice-cloning',
    price: 'paid',
    content: {
      service_name: 'elevenlabs_tts',
      label: 'ElevenLabs TTS',
      endpoint: 'https://api.elevenlabs.io/v1',
      auth_type: 'api_key',
      documentation_url: 'https://elevenlabs.io/docs',
      category: 'ai',
      methods: [
        { method_name: 'text_to_speech', http_method: 'POST', endpoint: 'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}', description: 'Convert text to speech with a specific voice', parameters: { text: '', model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } } },
        { method_name: 'list_voices', http_method: 'GET', endpoint: 'https://api.elevenlabs.io/v1/voices', description: 'List all available voices' },
        { method_name: 'voice_clone', http_method: 'POST', endpoint: 'https://api.elevenlabs.io/v1/voices/add', description: 'Clone a voice from audio samples' },
      ],
    },
  },

  // ─── STABILITY AI ─────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'Stability AI', official: 1,
    title: 'Stability AI — Stable Diffusion',
    description: 'Generate, edit, and upscale images with Stable Diffusion 3 and SDXL. Control style, composition, and structure with inpainting and ControlNet.',
    tags: 'stability,stable-diffusion,image-generation,ai,creative,sdxl',
    price: 'paid',
    content: {
      service_name: 'stability_ai',
      label: 'Stability AI',
      endpoint: 'https://api.stability.ai/v2beta',
      auth_type: 'bearer',
      documentation_url: 'https://platform.stability.ai/docs/api-reference',
      category: 'ai',
      methods: [
        { method_name: 'generate_image', http_method: 'POST', endpoint: 'https://api.stability.ai/v2beta/stable-image/generate/core', description: 'Generate images from text with Stable Diffusion 3', parameters: { prompt: '', output_format: 'png' } },
        { method_name: 'upscale', http_method: 'POST', endpoint: 'https://api.stability.ai/v2beta/stable-image/upscale/conservative', description: 'Upscale an image up to 4K resolution' },
        { method_name: 'remove_background', http_method: 'POST', endpoint: 'https://api.stability.ai/v2beta/stable-image/edit/remove-background', description: 'Remove background from an image' },
        { method_name: 'inpaint', http_method: 'POST', endpoint: 'https://api.stability.ai/v2beta/stable-image/edit/inpaint', description: 'Fill in masked areas of an image' },
      ],
    },
  },

  // ─── ASSEMBLYAI ───────────────────────────────────────────────────────────

  {
    owner_id: 'system', type: 'api', provider: 'AssemblyAI', official: 1,
    title: 'AssemblyAI Speech Intelligence',
    description: 'Transcribe audio with speaker labels, auto-chapters, sentiment analysis, entity detection, PII redaction, and AI summarization.',
    tags: 'assemblyai,speech,transcription,audio,diarization,summarization',
    price: 'paid',
    content: {
      service_name: 'assemblyai',
      label: 'AssemblyAI',
      endpoint: 'https://api.assemblyai.com/v2',
      auth_type: 'api_key',
      documentation_url: 'https://www.assemblyai.com/docs',
      category: 'ai',
      methods: [
        { method_name: 'transcribe', http_method: 'POST', endpoint: 'https://api.assemblyai.com/v2/transcript', description: 'Submit audio for transcription with AI features', parameters: { audio_url: '', speaker_labels: true, auto_chapters: true, sentiment_analysis: true } },
        { method_name: 'get_transcript', http_method: 'GET', endpoint: 'https://api.assemblyai.com/v2/transcript/{id}', description: 'Poll for completed transcription result' },
        { method_name: 'lemur_task', http_method: 'POST', endpoint: 'https://api.assemblyai.com/lemur/v3/generate/task', description: 'Ask questions about transcribed audio using LeMUR (LLM)' },
      ],
    },
  },

];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

console.log('Clearing existing marketplace listings...');
db.prepare('DELETE FROM marketplace_listings').run();
db.prepare("DELETE FROM sqlite_sequence WHERE name='marketplace_listings'").run();
console.log('Cleared.');

const insert = db.prepare(`
  INSERT INTO marketplace_listings
    (owner_id, type, title, description, content, tags, price, status, provider, official, avg_rating, rating_count, install_count, created_at, updated_at)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, 0, 0, ?, ?)
`);

const insertAll = db.transaction((items) => {
  for (const item of items) {
    insert.run(
      item.owner_id,
      item.type,
      item.title,
      item.description,
      JSON.stringify(item.content),
      item.tags,
      item.price,
      item.provider,
      item.official,
      now,
      now
    );
  }
});

insertAll(listings);

console.log(`\nSeeded ${listings.length} marketplace listings:`);
const byProvider = {};
listings.forEach(l => { byProvider[l.provider] = (byProvider[l.provider] || 0) + 1; });
Object.entries(byProvider).sort().forEach(([p, n]) => console.log(`  ${p}: ${n}`));

db.close();
console.log('\nDone.');
