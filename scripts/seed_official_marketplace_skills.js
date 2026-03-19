#!/usr/bin/env node

/**
 * Seed official marketplace skills from verified first-party sources.
 * Insertion path: src/database.js -> createMarketplaceListing()
 */

const { db, createMarketplaceListing } = require('../src/database');

const OWNER_ID = process.env.MARKETPLACE_OWNER_ID || 'owner';
const SEED_TAG = 'official-seed-2026-03-19';

const listings = [
  {
    title: 'OpenAI: Function Calling Patterns (Official)',
    provider: 'OpenAI',
    description: 'Official OpenAI guide for function/tool calling with structured arguments and tool execution flows.',
    categoryTags: ['openai', 'tools', 'function-calling', 'official'],
    sourceUrl: 'https://platform.openai.com/docs/guides/function-calling',
    license: 'OpenAI Documentation Terms',
    content: {
      skill_name: 'OpenAI Function Calling',
      script_content: 'Implements OpenAI-recommended function-calling orchestration for external tools and APIs.',
      version: '1.0.0',
      category: 'integration',
      repo_url: 'https://platform.openai.com/docs/guides/function-calling',
      config_json: {
        provider: 'OpenAI',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://platform.openai.com/docs/guides/function-calling',
        license: 'OpenAI Documentation Terms',
      },
    },
  },
  {
    title: 'OpenAI: Built-in Tools via Responses API (Official)',
    provider: 'OpenAI',
    description: 'Official Responses API tools documentation (web search, file search, computer use) for agent capabilities.',
    categoryTags: ['openai', 'responses-api', 'tools', 'official'],
    sourceUrl: 'https://platform.openai.com/docs/guides/tools',
    license: 'OpenAI Documentation Terms',
    content: {
      skill_name: 'OpenAI Responses Built-in Tools',
      script_content: 'Uses OpenAI built-in tool interfaces per Responses API official guidance.',
      version: '1.0.0',
      category: 'automation',
      repo_url: 'https://platform.openai.com/docs/guides/tools',
      config_json: {
        provider: 'OpenAI',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://platform.openai.com/docs/guides/tools',
        license: 'OpenAI Documentation Terms',
      },
    },
  },
  {
    title: 'Anthropic: Claude Tool Use Workflow (Official)',
    provider: 'Anthropic',
    description: 'Official Anthropic tool use overview for Claude, including request/response patterns and tool definitions.',
    categoryTags: ['anthropic', 'claude', 'tool-use', 'official'],
    sourceUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview',
    license: 'Anthropic Documentation Terms',
    content: {
      skill_name: 'Anthropic Claude Tool Use',
      script_content: 'Implements Claude tool-use loop following Anthropic official docs.',
      version: '1.0.0',
      category: 'integration',
      repo_url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview',
      config_json: {
        provider: 'Anthropic',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview',
        license: 'Anthropic Documentation Terms',
      },
    },
  },
  {
    title: 'Anthropic: Prompt Engineering for Claude (Official)',
    provider: 'Anthropic',
    description: 'Official prompt engineering guidance for Claude models, reusable as a prompting skill template.',
    categoryTags: ['anthropic', 'prompting', 'claude', 'official'],
    sourceUrl: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
    license: 'Anthropic Documentation Terms',
    content: {
      skill_name: 'Claude Prompt Engineering Template',
      script_content: 'Prompt-construction pattern derived from Anthropic official prompt engineering guidance.',
      version: '1.0.0',
      category: 'productivity',
      repo_url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
      config_json: {
        provider: 'Anthropic',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
        license: 'Anthropic Documentation Terms',
      },
    },
  },
  {
    title: 'Google Gemini API: Function Calling (Official)',
    provider: 'Google AI',
    description: 'Official Gemini API function calling documentation for tool invocation and structured outputs.',
    categoryTags: ['google', 'gemini', 'function-calling', 'official'],
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/function-calling',
    license: 'Google Developers Site Terms',
    content: {
      skill_name: 'Gemini Function Calling',
      script_content: 'Tool/function-calling implementation based on Gemini API official docs.',
      version: '1.0.0',
      category: 'integration',
      repo_url: 'https://ai.google.dev/gemini-api/docs/function-calling',
      config_json: {
        provider: 'Google AI / Gemini',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://ai.google.dev/gemini-api/docs/function-calling',
        license: 'Google Developers Site Terms',
      },
    },
  },
  {
    title: 'Google Gemini API: Grounding with Google Search (Official)',
    provider: 'Google AI',
    description: 'Official Gemini grounding docs for using Google Search as a first-party tool connector.',
    categoryTags: ['google', 'gemini', 'grounding', 'search', 'official'],
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/grounding',
    license: 'Google Developers Site Terms',
    content: {
      skill_name: 'Gemini Grounding with Google Search',
      script_content: 'Grounded answer workflow using Gemini official grounding support.',
      version: '1.0.0',
      category: 'analytics',
      repo_url: 'https://ai.google.dev/gemini-api/docs/grounding',
      config_json: {
        provider: 'Google AI / Gemini',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://ai.google.dev/gemini-api/docs/grounding',
        license: 'Google Developers Site Terms',
      },
    },
  },
  {
    title: 'Microsoft Azure OpenAI: Function Calling (Official)',
    provider: 'Microsoft',
    description: 'Official Azure OpenAI documentation for function calling and tool orchestration on Azure.',
    categoryTags: ['microsoft', 'azure-openai', 'function-calling', 'official'],
    sourceUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/function-calling',
    license: 'Microsoft Learn Terms',
    content: {
      skill_name: 'Azure OpenAI Function Calling',
      script_content: 'Function-calling implementation pattern using Azure OpenAI official documentation.',
      version: '1.0.0',
      category: 'integration',
      repo_url: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/function-calling',
      config_json: {
        provider: 'Microsoft / Azure OpenAI',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/function-calling',
        license: 'Microsoft Learn Terms',
      },
    },
  },
  {
    title: 'Microsoft Semantic Kernel Connectors (Official Repo)',
    provider: 'Microsoft',
    description: 'Official Semantic Kernel repository with plugin/connector patterns for multi-service AI orchestration.',
    categoryTags: ['microsoft', 'semantic-kernel', 'connectors', 'official-repo'],
    sourceUrl: 'https://github.com/microsoft/semantic-kernel',
    license: 'MIT',
    content: {
      skill_name: 'Semantic Kernel Connector Patterns',
      script_content: 'Connector/plugin orchestration style derived from Microsoft Semantic Kernel.',
      version: '1.0.0',
      category: 'automation',
      repo_url: 'https://github.com/microsoft/semantic-kernel',
      config_json: {
        provider: 'Microsoft',
        official: true,
        verified_source: true,
        source_type: 'official-repository',
        source_url: 'https://github.com/microsoft/semantic-kernel',
        license: 'MIT',
      },
    },
  },
  {
    title: 'Meta Llama Stack: Tool Calling (Official)',
    provider: 'Meta AI',
    description: 'Official Meta Llama Stack repository covering API and tool-calling capabilities for Llama-based apps.',
    categoryTags: ['meta', 'llama', 'llama-stack', 'tool-calling', 'official-repo'],
    sourceUrl: 'https://github.com/meta-llama/llama-stack',
    license: 'Llama Stack repository license (see source repo)',
    content: {
      skill_name: 'Llama Stack Tool Calling',
      script_content: 'Tool-calling and agent runtime pattern aligned with Meta Llama Stack.',
      version: '1.0.0',
      category: 'integration',
      repo_url: 'https://github.com/meta-llama/llama-stack',
      config_json: {
        provider: 'Meta AI',
        official: true,
        verified_source: true,
        source_type: 'official-repository',
        source_url: 'https://github.com/meta-llama/llama-stack',
        license: 'Llama Stack repository license (see source repo)',
      },
    },
  },
  {
    title: 'Cohere: Tool Use in Chat API (Official)',
    provider: 'Cohere',
    description: 'Official Cohere documentation for tool use/function calls in chat workflows.',
    categoryTags: ['cohere', 'tool-use', 'chat-api', 'official'],
    sourceUrl: 'https://docs.cohere.com/docs/tool-use',
    license: 'Cohere Documentation Terms',
    content: {
      skill_name: 'Cohere Tool Use',
      script_content: 'Implements Cohere official tool-use workflow for structured external actions.',
      version: '1.0.0',
      category: 'integration',
      repo_url: 'https://docs.cohere.com/docs/tool-use',
      config_json: {
        provider: 'Cohere',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://docs.cohere.com/docs/tool-use',
        license: 'Cohere Documentation Terms',
      },
    },
  },
  {
    title: 'Mistral: Function Calling Capability (Official)',
    provider: 'Mistral',
    description: 'Official Mistral documentation for function calling capability and tool schema usage.',
    categoryTags: ['mistral', 'function-calling', 'tools', 'official'],
    sourceUrl: 'https://docs.mistral.ai/capabilities/function_calling/',
    license: 'Mistral Documentation Terms',
    content: {
      skill_name: 'Mistral Function Calling',
      script_content: 'Function-calling flow implemented according to Mistral official capability docs.',
      version: '1.0.0',
      category: 'integration',
      repo_url: 'https://docs.mistral.ai/capabilities/function_calling/',
      config_json: {
        provider: 'Mistral',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://docs.mistral.ai/capabilities/function_calling/',
        license: 'Mistral Documentation Terms',
      },
    },
  },
  {
    title: 'Perplexity Sonar API: Official Docs',
    provider: 'Perplexity',
    description: 'Official Perplexity API documentation for Sonar models and web-grounded answer workflows.',
    categoryTags: ['perplexity', 'sonar', 'search', 'official'],
    sourceUrl: 'https://docs.perplexity.ai/',
    license: 'Perplexity Documentation Terms',
    content: {
      skill_name: 'Perplexity Sonar Search',
      script_content: 'Web-grounded retrieval/answer pattern using Perplexity Sonar API docs.',
      version: '1.0.0',
      category: 'analytics',
      repo_url: 'https://docs.perplexity.ai/',
      config_json: {
        provider: 'Perplexity',
        official: true,
        verified_source: true,
        source_type: 'official-docs',
        source_url: 'https://docs.perplexity.ai/',
        license: 'Perplexity Documentation Terms',
      },
    },
  },
];

function existsByTitleAndSource(title, sourceUrl) {
  const rows = db.prepare(`SELECT id, content FROM marketplace_listings WHERE type='skill' AND title = ? AND status != 'removed'`).all(title);
  for (const row of rows) {
    try {
      const parsed = row.content ? JSON.parse(row.content) : {};
      const src = parsed?.config_json?.source_url;
      if (src === sourceUrl) return row.id;
    } catch {}
  }
  return null;
}

function main() {
  const inserted = [];
  const skipped = [];

  for (const item of listings) {
    const existingId = existsByTitleAndSource(item.title, item.sourceUrl);
    if (existingId) {
      skipped.push({ title: item.title, id: existingId, reason: 'already exists' });
      continue;
    }

    const tags = Array.from(new Set([...item.categoryTags, item.provider.toLowerCase().replace(/\s+/g, '-'), SEED_TAG])).join(',');

    const listing = createMarketplaceListing(
      OWNER_ID,
      'skill',
      item.title,
      item.description,
      item.content,
      tags,
      'free'
    );

    inserted.push({
      id: listing.id,
      title: listing.title,
      provider: item.provider,
      sourceUrl: item.sourceUrl,
      license: item.license,
    });
  }

  const allSeeded = db.prepare(`
    SELECT id, title, tags, content, created_at
    FROM marketplace_listings
    WHERE type='skill' AND tags LIKE ? AND status='active'
    ORDER BY id ASC
  `).all(`%${SEED_TAG}%`).map((r) => {
    let sourceUrl = null;
    let provider = null;
    let official = false;
    try {
      const c = JSON.parse(r.content || '{}');
      sourceUrl = c?.config_json?.source_url || null;
      provider = c?.config_json?.provider || null;
      official = !!c?.config_json?.official;
    } catch {}
    return { id: r.id, title: r.title, provider, sourceUrl, official, createdAt: r.created_at };
  });

  const output = {
    ownerId: OWNER_ID,
    seedTag: SEED_TAG,
    insertedCount: inserted.length,
    skippedCount: skipped.length,
    totalSeededActive: allSeeded.length,
    inserted,
    skipped,
    seededListings: allSeeded,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
