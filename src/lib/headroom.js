const axios = require('axios');

function envFlag(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function getHeadroomConfig() {
  return {
    enabled: envFlag('HEADROOM_ENABLED', false),
    baseUrl: String(process.env.HEADROOM_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, ''),
    model: String(process.env.HEADROOM_MODEL || 'gpt-4o'),
    targetRatio: Number(process.env.HEADROOM_TARGET_RATIO || 0.35),
    minBytes: Number(process.env.HEADROOM_MIN_BYTES || 1800),
    llmMinBytes: Number(process.env.HEADROOM_LLM_MIN_BYTES || 1800),
    timeoutMs: Number(process.env.HEADROOM_TIMEOUT_MS || 15000),
  };
}

function wantsHeadroom(req) {
  const queryFlag = req?.query?.optimize_for_ai;
  const headerFlag = req?.headers?.['x-myapi-optimize'];
  const value = [queryFlag, headerFlag].find((v) => v !== undefined && v !== null);
  if (value == null) return false;
  return ['1', 'true', 'yes', 'on', 'headroom', 'attach', 'replace'].includes(String(value).trim().toLowerCase());
}

function requestedResponseMode(req) {
  const explicit = req?.query?.optimize_mode || req?.headers?.['x-myapi-optimize-mode'] || req?.headers?.['x-myapi-optimize'];
  const normalized = String(explicit || '').trim().toLowerCase();
  return normalized === 'replace' ? 'replace' : 'attach';
}

function serializePayload(payload) {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    return String(payload);
  }
}

function byteLength(value) {
  return Buffer.byteLength(String(value || ''), 'utf8');
}

async function callHeadroomCompress(content, options = {}) {
  const cfg = getHeadroomConfig();
  const label = options.label || 'API response';
  const response = await axios.post(
    `${cfg.baseUrl}/v1/compress`,
    {
      model: options.model || cfg.model,
      messages: [
        {
          role: 'user',
          content: `Compress this ${label} for an AI agent. Preserve identifiers, names, URLs, timestamps, errors, counts, pagination, status fields, and action-relevant values. Keep field names and structure cues concise and easy to scan.`,
        },
        { role: 'tool', content },
      ],
      target_ratio: Number.isFinite(options.targetRatio) ? options.targetRatio : cfg.targetRatio,
    },
    {
      timeout: options.timeoutMs || cfg.timeoutMs,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const data = response.data || {};
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const compressed = messages[1]?.content || messages[messages.length - 1]?.content || content;
  return {
    content: typeof compressed === 'string' ? compressed : serializePayload(compressed),
    tokensBefore: Number(data.tokens_before || 0),
    tokensAfter: Number(data.tokens_after || 0),
    tokensSaved: Number(data.tokens_saved || 0),
    compressionRatio: typeof data.compression_ratio === 'number' ? data.compression_ratio : null,
    transformsApplied: Array.isArray(data.transforms_applied) ? data.transforms_applied : [],
  };
}

async function maybeOptimizeApiResponse(req, body, options = {}) {
  const cfg = getHeadroomConfig();
  if (!cfg.enabled || !wantsHeadroom(req)) return body;

  const select = typeof options.select === 'function' ? options.select : (value) => value;
  const selected = select(body);
  const serialized = serializePayload(selected);
  const originalBytes = byteLength(serialized);
  if (originalBytes < (options.minBytes || cfg.minBytes)) {
    return attachHeadroomMetadata(body, {
      applied: false,
      reason: 'below_threshold',
      originalBytes,
      label: options.label || 'API response',
    }, options, req);
  }

  try {
    const compressed = await callHeadroomCompress(serialized, {
      label: options.label,
      model: options.model,
      targetRatio: options.targetRatio,
      timeoutMs: options.timeoutMs,
    });

    return attachOptimizedPayload(body, compressed, {
      label: options.label || 'API response',
      originalBytes,
      mode: options.mode || requestedResponseMode(req),
      optimizedField: options.optimizedField || 'optimized_context',
      assignOptimized: options.assignOptimized,
      wrapArray: options.wrapArray !== false,
    });
  } catch (error) {
    return attachHeadroomMetadata(body, {
      applied: false,
      reason: 'compression_failed',
      error: error.message,
      originalBytes,
      label: options.label || 'API response',
    }, options, req);
  }
}

function attachOptimizedPayload(body, compressed, options = {}) {
  const optimizedField = options.optimizedField || 'optimized_context';
  const compressedBytes = byteLength(compressed.content);
  const mode = options.mode || 'attach';
  const wrapArray = options.wrapArray !== false;

  let out;
  if (Array.isArray(body)) {
    if (!wrapArray) return body;
    out = { data: body };
  } else if (body && typeof body === 'object') {
    out = { ...body };
  } else {
    out = { data: body };
  }

  if (mode === 'replace' && typeof options.assignOptimized === 'function') {
    options.assignOptimized(out, compressed.content);
  } else {
    out[optimizedField] = compressed.content;
  }

  out.headroom = {
    applied: true,
    label: options.label,
    mode,
    originalBytes: options.originalBytes,
    compressedBytes,
    bytesSaved: Math.max(0, options.originalBytes - compressedBytes),
    tokensBefore: compressed.tokensBefore,
    tokensAfter: compressed.tokensAfter,
    tokensSaved: compressed.tokensSaved,
    compressionRatio: compressed.compressionRatio,
    transformsApplied: compressed.transformsApplied,
  };

  return out;
}

function attachHeadroomMetadata(body, meta, options = {}, req = null) {
  if (!wantsHeadroom(req)) return body;
  let out;
  if (Array.isArray(body)) {
    if (options.wrapArray === false) return body;
    out = { data: body };
  } else if (body && typeof body === 'object') {
    out = { ...body };
  } else {
    out = { data: body };
  }
  out.headroom = meta;
  return out;
}

async function maybeCompressMessagesForLLM(messages, options = {}) {
  const cfg = getHeadroomConfig();
  if (!cfg.enabled || !Array.isArray(messages) || messages.length === 0) {
    return { messages, headroom: { applied: false, reason: 'disabled_or_empty' } };
  }

  const serialized = serializePayload(messages);
  const originalBytes = byteLength(serialized);
  if (originalBytes < (options.minBytes || cfg.llmMinBytes)) {
    return { messages, headroom: { applied: false, reason: 'below_threshold', originalBytes } };
  }

  try {
    const compressed = await callHeadroomCompress(serialized, {
      label: options.label || 'LLM prompt messages',
      model: options.model || cfg.model,
      targetRatio: options.targetRatio,
      timeoutMs: options.timeoutMs,
    });
    const parsed = JSON.parse(compressed.content);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Headroom returned non-array prompt payload');
    }
    return {
      messages: parsed,
      headroom: {
        applied: true,
        originalBytes,
        compressedBytes: byteLength(compressed.content),
        tokensBefore: compressed.tokensBefore,
        tokensAfter: compressed.tokensAfter,
        tokensSaved: compressed.tokensSaved,
        compressionRatio: compressed.compressionRatio,
        transformsApplied: compressed.transformsApplied,
      },
    };
  } catch (error) {
    return {
      messages,
      headroom: {
        applied: false,
        reason: 'compression_failed',
        error: error.message,
        originalBytes,
      },
    };
  }
}

module.exports = {
  getHeadroomConfig,
  wantsHeadroom,
  requestedResponseMode,
  maybeOptimizeApiResponse,
  maybeCompressMessagesForLLM,
};
