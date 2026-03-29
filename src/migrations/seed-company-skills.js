/**
 * Seed script: Add 14 company API skills to marketplace
 * Run: node src/migrations/seed-company-skills.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/myapi.db');
const db = new Database(dbPath);

const companySkills = [
  {
    title: 'OpenAI GPT-4 Turbo',
    description: 'Access to GPT-4 Turbo with 128K context window, vision, and function calling capabilities',
    type: 'skill',
    ownerName: 'OpenAI',
    category: 'ai-models',
    content: {
      skill_name: 'openai-gpt4-turbo',
      description: 'GPT-4 Turbo language model integration',
      version: '1.0.0',
      author: 'OpenAI',
      category: 'ai-models',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      documentation_url: 'https://platform.openai.com/docs/models/gpt-4-turbo',
      script_content: `async function callGPT4(prompt, options = {}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\` },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 2048,
      ...options
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'Google Gemini Pro',
    description: 'Google\'s Gemini Pro multimodal AI model with text, vision, and code understanding',
    type: 'skill',
    ownerName: 'Google',
    category: 'ai-models',
    content: {
      skill_name: 'google-gemini-pro',
      description: 'Gemini Pro language model',
      version: '1.0.0',
      author: 'Google',
      category: 'ai-models',
      endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
      documentation_url: 'https://ai.google.dev/',
      script_content: `async function callGemini(prompt, options = {}) {
  const response = await fetch(\`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=\${process.env.GOOGLE_API_KEY}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: options.maxTokens || 2048 }
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'Anthropic Claude 3',
    description: 'Claude 3 models (Opus, Sonnet, Haiku) from Anthropic with advanced reasoning',
    type: 'skill',
    ownerName: 'Anthropic',
    category: 'ai-models',
    content: {
      skill_name: 'anthropic-claude-3',
      description: 'Claude 3 language models',
      version: '1.0.0',
      author: 'Anthropic',
      category: 'ai-models',
      endpoint: 'https://api.anthropic.com/v1/messages',
      documentation_url: 'https://docs.anthropic.com/claude/reference',
      script_content: `async function callClaude(prompt, options = {}) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: options.model || 'claude-3-opus-20240229',
      max_tokens: options.maxTokens || 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'Microsoft Azure OpenAI',
    description: 'Azure OpenAI Service with GPT-4, GPT-3.5-turbo, and embeddings on Microsoft infrastructure',
    type: 'skill',
    ownerName: 'Microsoft',
    category: 'ai-models',
    content: {
      skill_name: 'microsoft-azure-openai',
      description: 'Azure OpenAI models',
      version: '1.0.0',
      author: 'Microsoft',
      category: 'ai-models',
      endpoint: 'https://{resource-name}.openai.azure.com/openai/deployments/{deployment-id}/chat/completions',
      documentation_url: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
      script_content: `async function callAzureOpenAI(prompt, options = {}) {
  const response = await fetch(\`https://\${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/openai/deployments/\${process.env.AZURE_DEPLOYMENT_ID}/chat/completions?api-version=2024-02-15-preview\`, {
    method: 'POST',
    headers: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 2048
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'AWS Bedrock',
    description: 'Amazon Bedrock - foundation models from AI21, Anthropic, Meta, Mistral, and Stability AI',
    type: 'skill',
    ownerName: 'Amazon',
    category: 'ai-models',
    content: {
      skill_name: 'aws-bedrock',
      description: 'AWS Bedrock foundation models',
      version: '1.0.0',
      author: 'Amazon',
      category: 'ai-models',
      endpoint: 'https://bedrock.{region}.amazonaws.com/model/{model-id}/invoke',
      documentation_url: 'https://docs.aws.amazon.com/bedrock/',
      script_content: `async function callBedrock(prompt, options = {}) {
  const AWS = require('aws-sdk');
  const bedrock = new AWS.BedrockRuntime({ region: process.env.AWS_REGION });
  const response = await bedrock.invokeModel({
    modelId: options.modelId || 'anthropic.claude-3-sonnet-20240229-v1:0',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-06-01',
      max_tokens: options.maxTokens || 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  }).promise();
  return JSON.parse(response.body.toString());
}`,
    },
    official: true,
  },
  {
    title: 'Mistral AI',
    description: 'Mistral AI models including Mistral Large and Mistral Embeddings',
    type: 'skill',
    ownerName: 'Mistral AI',
    category: 'ai-models',
    content: {
      skill_name: 'mistral-ai',
      description: 'Mistral AI language models',
      version: '1.0.0',
      author: 'Mistral AI',
      category: 'ai-models',
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      documentation_url: 'https://docs.mistral.ai/api/',
      script_content: `async function callMistral(prompt, options = {}) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${process.env.MISTRAL_API_KEY}\` },
    body: JSON.stringify({
      model: options.model || 'mistral-large-latest',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.maxTokens || 2048
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'Cohere',
    description: 'Cohere Command, Rerank, and Embedding models for NLP tasks',
    type: 'skill',
    ownerName: 'Cohere',
    category: 'ai-models',
    content: {
      skill_name: 'cohere-api',
      description: 'Cohere language models',
      version: '1.0.0',
      author: 'Cohere',
      category: 'ai-models',
      endpoint: 'https://api.cohere.ai/v1/generate',
      documentation_url: 'https://docs.cohere.com/',
      script_content: `async function callCohere(prompt, options = {}) {
  const response = await fetch('https://api.cohere.ai/v1/generate', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${process.env.COHERE_API_KEY}\` },
    body: JSON.stringify({
      model: options.model || 'command',
      prompt: prompt,
      max_tokens: options.maxTokens || 2048
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'Meta Llama 2',
    description: 'Open-source Llama 2 models from Meta - 7B, 13B, and 70B parameter versions',
    type: 'skill',
    ownerName: 'Meta',
    category: 'ai-models',
    content: {
      skill_name: 'meta-llama2',
      description: 'Llama 2 language models',
      version: '1.0.0',
      author: 'Meta',
      category: 'ai-models',
      endpoint: 'https://www.replicate.com/api/v1/predictions',
      documentation_url: 'https://llama.meta.com/',
      script_content: `async function callLlama(prompt, options = {}) {
  const response = await fetch('https://www.replicate.com/api/v1/predictions', {
    method: 'POST',
    headers: { 'Authorization': \`Token \${process.env.REPLICATE_API_TOKEN}\` },
    body: JSON.stringify({
      version: options.version || 'meta/llama-2-70b-chat',
      input: { prompt: prompt, max_tokens: options.maxTokens || 2048 }
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'ElevenLabs TTS',
    description: 'ElevenLabs text-to-speech with natural voices, voice cloning, and multilingual support',
    type: 'skill',
    ownerName: 'ElevenLabs',
    category: 'audio',
    content: {
      skill_name: 'elevenlabs-tts',
      description: 'Text-to-speech synthesis',
      version: '1.0.0',
      author: 'ElevenLabs',
      category: 'audio',
      endpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
      documentation_url: 'https://elevenlabs.io/docs',
      script_content: `async function synthesizeAudio(text, voiceId = 'EXAVITQu4vr4xnSDxMaL') {
  const response = await fetch(\`https://api.elevenlabs.io/v1/text-to-speech/\${voiceId}\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });
  return response.arrayBuffer();
}`,
    },
    official: true,
  },
  {
    title: 'Stability AI Image Generation',
    description: 'Stable Diffusion image generation, editing, and upscaling from Stability AI',
    type: 'skill',
    ownerName: 'Stability AI',
    category: 'image-generation',
    content: {
      skill_name: 'stability-ai-images',
      description: 'Image generation and manipulation',
      version: '1.0.0',
      author: 'Stability AI',
      category: 'image-generation',
      endpoint: 'https://api.stability.ai/v1/generate/stable-diffusion-xl-1024-v1-0/text-to-image',
      documentation_url: 'https://platform.stability.ai/docs',
      script_content: `async function generateImage(prompt, options = {}) {
  const response = await fetch('https://api.stability.ai/v1/generate/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${process.env.STABILITY_API_KEY}\` },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: options.cfgScale || 7,
      height: options.height || 1024,
      width: options.width || 1024,
      steps: options.steps || 30,
      samples: options.samples || 1
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'Perplexity Sonar API',
    description: 'Perplexity AI Sonar - real-time web search integrated with LLM for up-to-date answers',
    type: 'skill',
    ownerName: 'Perplexity',
    category: 'search-ai',
    content: {
      skill_name: 'perplexity-sonar',
      description: 'Real-time search with AI',
      version: '1.0.0',
      author: 'Perplexity',
      category: 'search-ai',
      endpoint: 'https://api.perplexity.ai/chat/completions',
      documentation_url: 'https://docs.perplexity.ai/',
      script_content: `async function searchWithPerplexity(query, options = {}) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${process.env.PERPLEXITY_API_KEY}\` },
    body: JSON.stringify({
      model: 'pplx-70b-online',
      messages: [{ role: 'user', content: query }],
      max_tokens: options.maxTokens || 2048,
      search_recency_filter: options.recency || 'week'
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'AssemblyAI Speech-to-Text',
    description: 'AssemblyAI speech-to-text with real-time streaming, speaker detection, and entity recognition',
    type: 'skill',
    ownerName: 'AssemblyAI',
    category: 'audio',
    content: {
      skill_name: 'assemblyai-stt',
      description: 'Speech-to-text and audio intelligence',
      version: '1.0.0',
      author: 'AssemblyAI',
      category: 'audio',
      endpoint: 'https://api.assemblyai.com/v2/transcript',
      documentation_url: 'https://www.assemblyai.com/docs',
      script_content: `async function transcribeAudio(audioUrl, options = {}) {
  const response = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { 'Authorization': process.env.ASSEMBLYAI_API_KEY },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_detection: options.languageDetection || false,
      speaker_labels: options.speakerLabels || false,
      entity_detection: options.entityDetection || true
    })
  });
  const result = await response.json();
  // Poll for completion
  return pollTranscript(result.id);
}`,
    },
    official: true,
  },
  {
    title: 'Google Cloud Vision API',
    description: 'Google Cloud Vision for image recognition, text detection (OCR), and content moderation',
    type: 'skill',
    ownerName: 'Google',
    category: 'image-analysis',
    content: {
      skill_name: 'google-cloud-vision',
      description: 'Image analysis and OCR',
      version: '1.0.0',
      author: 'Google',
      category: 'image-analysis',
      endpoint: 'https://vision.googleapis.com/v1/images:annotate',
      documentation_url: 'https://cloud.google.com/vision/docs',
      script_content: `async function analyzeImage(imageUrl, options = {}) {
  const response = await fetch('https://vision.googleapis.com/v1/images:annotate?key=\${process.env.GOOGLE_API_KEY}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { source: { imageUri: imageUrl } },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 10 },
          { type: 'TEXT_DETECTION' },
          { type: 'SAFE_SEARCH_DETECTION' }
        ]
      }]
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
  {
    title: 'OpenAI Embeddings',
    description: 'OpenAI text embedding models for semantic search, clustering, and similarity matching',
    type: 'skill',
    ownerName: 'OpenAI',
    category: 'embeddings',
    content: {
      skill_name: 'openai-embeddings',
      description: 'Text embeddings for semantic understanding',
      version: '1.0.0',
      author: 'OpenAI',
      category: 'embeddings',
      endpoint: 'https://api.openai.com/v1/embeddings',
      documentation_url: 'https://platform.openai.com/docs/guides/embeddings',
      script_content: `async function generateEmbedding(text, options = {}) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\` },
    body: JSON.stringify({
      model: options.model || 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    })
  });
  return response.json();
}`,
    },
    official: true,
  },
];

const now = new Date().toISOString();

try {
  const insertStmt = db.prepare(`
    INSERT INTO marketplace_listings (owner_id, type, title, description, content, official, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const skill of companySkills) {
    try {
      const result = insertStmt.run(
        'system',  // owner_id for system/official integrations
        skill.type,
        skill.title,
        skill.description,
        JSON.stringify(skill.content),
        skill.official ? 1 : 0,
        now,
        now
      );
      inserted++;
      console.log(`✓ Inserted: ${skill.title} (ID: ${result.lastInsertRowid})`);
    } catch (err) {
      console.error(`✗ Failed to insert ${skill.title}:`, err.message);
    }
  }

  console.log(`\n✅ Seeding complete: ${inserted}/${companySkills.length} skills added`);
} catch (err) {
  console.error('Database error:', err.message);
  process.exit(1);
} finally {
  db.close();
}
