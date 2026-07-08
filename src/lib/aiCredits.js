'use strict';

/**
 * Economics for MyApi-provided AI in automations.
 *
 * Principle: MyApi-mode AI must never cost more than it earns. We do that by
 * (1) defaulting to cheap models, (2) bounding per-run tokens, and (3) BILLING
 * every MyApi-mode run as credits at provider-cost × markup, so the platform
 * profits on every run by construction. BYO-key runs use the user's own key and
 * are free to the platform (never metered here).
 *
 * Credits are the user-facing unit: 1 credit = 1 US cent of *charged* value.
 * Internally we meter real tokens, apply the markup, and round up to whole
 * credits. The per-plan included allowance is enforced by the Stripe meter's
 * graduated price (first N credits/month free) — see lib/overageReporter.js.
 */

const AI_MARKUP = 2; // charged = provider cost × this

// Provider list price, USD per 1,000,000 tokens {in, out}. Keep conservative —
// unknown models fall back to the most expensive tier so we never undercharge.
const MODEL_PRICING = {
  'claude-haiku-4-5':   { in: 1.0,  out: 5.0 },
  'claude-sonnet-4-6':  { in: 3.0,  out: 15.0 },
  'claude-opus-4-8':    { in: 5.0,  out: 25.0 },
  'claude-opus-4-7':    { in: 5.0,  out: 25.0 },
  'claude-fable-5':     { in: 10.0, out: 50.0 },
  'gpt-4o-mini':        { in: 0.15, out: 0.6 },
  'gpt-4o':             { in: 2.5,  out: 10.0 },
  'openai/gpt-4o-mini': { in: 0.15, out: 0.6 },
  'openai/gpt-4o':      { in: 2.5,  out: 10.0 },
  'anthropic/claude-3.5-sonnet': { in: 3.0, out: 15.0 },
};
const FALLBACK_PRICING = { in: 10.0, out: 50.0 };

function pricingFor(model) {
  const m = String(model || '').toLowerCase();
  if (MODEL_PRICING[m]) return MODEL_PRICING[m];
  // loose contains-match (e.g. dated variants, openrouter prefixes)
  for (const [key, price] of Object.entries(MODEL_PRICING)) {
    if (m.includes(key)) return price;
  }
  if (m.includes('haiku')) return MODEL_PRICING['claude-haiku-4-5'];
  if (m.includes('mini')) return MODEL_PRICING['gpt-4o-mini'];
  return FALLBACK_PRICING;
}

function rawCostUsd(model, usage = {}) {
  const p = pricingFor(model);
  const inT = Number(usage.input_tokens || 0);
  const outT = Number(usage.output_tokens || 0);
  return (inT / 1e6) * p.in + (outT / 1e6) * p.out;
}

// Whole credits charged for a run (1 credit = 1 cent of charged value).
function creditsForRun(model, usage = {}) {
  const charged = rawCostUsd(model, usage) * AI_MARKUP; // USD
  return Math.max(1, Math.ceil(charged * 100));         // ≥1 credit per real run
}

// Per-plan MyApi-AI policy. Included credits are enforced by Stripe's graduated
// price; the run cap is a hard belt-and-suspenders guard against runaways/bugs.
// minIntervalMinutes throttles platform-mode schedules (BYO is unrestricted).
const PLAN_AI = {
  free:       { platform: false, includedCredits: 0,   monthlyRunCap: 0,    minIntervalMinutes: 0 },
  pro:        { platform: true,  includedCredits: 150, monthlyRunCap: 1000, minIntervalMinutes: 60 },
  enterprise: { platform: true,  includedCredits: 500, monthlyRunCap: 5000, minIntervalMinutes: 60 },
  beta:       { platform: true,  includedCredits: 500, monthlyRunCap: 5000, minIntervalMinutes: 60 },
};

function planAi(planId) {
  return PLAN_AI[String(planId || 'free').toLowerCase()] || PLAN_AI.free;
}

// First day of the current calendar month, ISO (UTC) — the metering window.
function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

module.exports = {
  AI_MARKUP, MODEL_PRICING, pricingFor, rawCostUsd, creditsForRun,
  PLAN_AI, planAi, monthStartIso,
};
