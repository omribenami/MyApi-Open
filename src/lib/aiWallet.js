'use strict';

/**
 * Prepaid AI wallet + spend controls for MyApi-provided AI.
 *
 * Money model (BYO key is always free and never touches any of this):
 *   - Each plan grants `includedCredits` free per month (consumed first).
 *   - Beyond that, runs draw from a PREPAID balance (credits the user bought).
 *   - When the balance is exhausted (and auto-reload is off/unavailable), MyApi
 *     AI stops — the user is never charged for more than they pre-loaded.
 *   - 1 credit = 1 US cent of charged value (credits ↔ cents 1:1).
 *
 * User controls (stored in user_preferences.aiWallet):
 *   - spendLimitCredits : hard monthly cap on credits charged BEYOND the included
 *     allowance (null = no cap; the balance still bounds spend). Blocks runs at the cap.
 *   - alertPercent      : notify once when usage crosses this % of the limit/allowance.
 *   - autoReload        : { enabled, whenBelowCredits, topUpCredits } — top up the
 *     balance from the saved card when it runs low (respecting the spend limit).
 */

const db = require('../database');
const { planAi, monthStartIso } = require('./aiCredits');
// stripeClient is a closed-source module; in MyApi Open payments are simply
// unavailable — every call site already treats a null client as "not configured".
let getStripeClient = () => null;
try {
  ({ getStripeClient } = require('./stripeClient'));
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') throw err;
}

const WALLET_KEY = 'aiWallet';
const DEFAULTS = {
  balanceCredits: 0,
  spendLimitCredits: null,
  alertPercent: 80,
  autoReload: { enabled: false, whenBelowCredits: 100, topUpCredits: 1000 },
  lastAlertKey: '',
};

function getWallet(userId) {
  const w = (db.getUserPreferences(userId) || {})[WALLET_KEY] || {};
  return {
    ...DEFAULTS, ...w,
    autoReload: { ...DEFAULTS.autoReload, ...(w.autoReload || {}) },
  };
}

function saveWallet(userId, patch) {
  const prefs = db.getUserPreferences(userId) || {};
  const cur = getWallet(userId);
  const next = { ...cur, ...patch };
  if (patch.autoReload) next.autoReload = { ...cur.autoReload, ...patch.autoReload };
  prefs[WALLET_KEY] = next;
  db.setUserPreferences(userId, prefs);
  return next;
}

function addCredits(userId, credits) {
  const n = Math.round(Number(credits) || 0);
  if (!n) return getWallet(userId);
  const w = getWallet(userId);
  return saveWallet(userId, { balanceCredits: Math.max(0, w.balanceCredits + n) });
}

function ownerPlanId(userId) {
  try { return String(db.getUserById(userId)?.plan || 'free').toLowerCase(); } catch { return 'free'; }
}

// Month-to-date spend picture for a user.
function spendStatus(userId, planId = ownerPlanId(userId)) {
  const policy = planAi(planId);
  const wallet = getWallet(userId);
  let used = { credits: 0, runs: 0, costCents: 0 };
  try { used = db.getMonthlyAiUsage(userId, monthStartIso()); } catch (_) {}
  const included = policy.includedCredits;
  const includedRemaining = Math.max(0, included - used.credits);
  const overageUsed = Math.max(0, used.credits - included);     // credits charged beyond free
  const balance = wallet.balanceCredits;
  const available = includedRemaining + balance;                 // credits available before charging stops
  const limit = wallet.spendLimitCredits;
  const limitReached = limit != null && overageUsed >= limit;
  return {
    planId, policy, wallet, used,
    included, includedRemaining, overageUsed, balance, available,
    spendLimitCredits: limit, limitReached,
    platform: policy.platform,
  };
}

// Pre-run gate: can a MyApi-mode run proceed right now?
function canRunPlatform(status) {
  if (!status.platform) return { ok: false, statusCode: 402, error: 'MyApi-provided AI is not available on your plan. Add your own API key (free) in settings, or upgrade.' };
  if (status.limitReached) return { ok: false, statusCode: 402, error: `Monthly AI spend limit reached ($${(status.spendLimitCredits / 100).toFixed(2)}). Raise it in settings, use your own key, or wait until next month.` };
  if (status.available <= 0) {
    return { ok: false, statusCode: 402, error: 'Out of AI balance. Add credits (or enable auto-reload) in Automations settings, or use your own API key (free).' };
  }
  return { ok: true };
}

// After a run: draw the over-allowance portion from the prepaid balance.
function deductForRun(userId, chargedCredits, includedRemainingPreRun) {
  const balanceDraw = Math.max(0, Math.round(chargedCredits) - Math.max(0, includedRemainingPreRun));
  if (balanceDraw <= 0) return getWallet(userId);
  const w = getWallet(userId);
  return saveWallet(userId, { balanceCredits: w.balanceCredits - balanceDraw }); // may dip <0; next run is gated
}

// Notify once when usage crosses the alert threshold (deduped per month+level).
function maybeAlert(userId, status, notify) {
  const w = status.wallet;
  const pct = Number(w.alertPercent) || 0;
  if (!pct) return;
  const month = monthStartIso().slice(0, 7);
  // Alert against the spend limit if set, else against the included allowance.
  const basis = status.spendLimitCredits != null ? status.spendLimitCredits : status.included;
  const measured = status.spendLimitCredits != null ? status.overageUsed : status.used.credits;
  if (!basis) return;
  const ratio = measured / basis;
  let level = null;
  if (ratio >= 1) level = '100';
  else if (ratio >= pct / 100) level = String(pct);
  if (!level) return;
  const key = `${month}:${status.spendLimitCredits != null ? 'limit' : 'allow'}:${level}`;
  if (w.lastAlertKey === key) return; // already alerted at this level this month
  saveWallet(userId, { lastAlertKey: key });
  const pctUsed = Math.min(100, Math.round(ratio * 100));
  const what = status.spendLimitCredits != null ? 'spend limit' : 'included AI allowance';
  try {
    notify(level === '100'
      ? `You've reached your ${what} for MyApi AI this month. ${status.wallet.autoReload.enabled ? 'Auto-reload will top up your balance.' : 'Add credits or use your own key to keep automations running.'}`
      : `You've used ${pctUsed}% of your ${what} for MyApi AI this month.`);
  } catch (_) { /* best-effort */ }
}

// Charge the saved card off-session to top up the balance (auto-reload).
// Safe by default: only fires when enabled AND a default payment method exists.
async function attemptAutoReload(userId, workspaceId, notify) {
  const w = getWallet(userId);
  if (!w.autoReload.enabled) return { ok: false, reason: 'disabled' };
  if (w.balanceCredits >= w.autoReload.whenBelowCredits) return { ok: false, reason: 'above_threshold' };
  // Respect the spend limit: don't reload if the user is already capped this month.
  const status = spendStatus(userId);
  if (status.limitReached) return { ok: false, reason: 'limit_reached' };

  const stripe = getStripeClient();
  const customer = workspaceId ? db.getBillingCustomerByWorkspace(workspaceId) : null;
  if (!stripe || !customer?.stripe_customer_id) {
    try { notify('Your MyApi AI balance is low. Add credits in Automations settings to keep automations running.'); } catch (_) {}
    return { ok: false, reason: 'no_payment_method' };
  }
  const amount = Math.max(100, Math.round(w.autoReload.topUpCredits)); // cents
  try {
    const cust = await stripe.customers.retrieve(customer.stripe_customer_id);
    const pm = cust?.invoice_settings?.default_payment_method;
    if (!pm) {
      try { notify('Your MyApi AI balance is low. Add a payment method or buy credits in Automations settings.'); } catch (_) {}
      return { ok: false, reason: 'no_default_pm' };
    }
    await stripe.paymentIntents.create({
      amount, currency: 'usd', customer: customer.stripe_customer_id,
      payment_method: pm, off_session: true, confirm: true,
      description: 'MyApi AI credits auto-reload',
      metadata: { kind: 'ai_topup', user_id: String(userId), credits: String(amount) },
    });
    addCredits(userId, amount);
    try { notify(`Auto-reloaded $${(amount / 100).toFixed(2)} of MyApi AI credits.`); } catch (_) {}
    return { ok: true, credits: amount };
  } catch (err) {
    try { notify('MyApi AI auto-reload failed (payment declined). Add credits manually to keep automations running.'); } catch (_) {}
    return { ok: false, reason: 'charge_failed', error: err.message };
  }
}

// Manual top-up: a Stripe Checkout session for buying credits (1 credit = 1¢).
async function createTopUpCheckout(userId, workspaceId, amountCents) {
  const amount = Math.round(Number(amountCents) || 0);
  if (amount < 100) return { ok: false, error: 'Minimum top-up is $1.00' };
  const stripe = getStripeClient();
  if (!stripe) return { ok: false, error: 'Payments are not configured on this server.' };
  let customer = workspaceId ? db.getBillingCustomerByWorkspace(workspaceId) : null;
  if (!customer?.stripe_customer_id) return { ok: false, error: 'No billing customer on file — set up billing first.' };
  const baseUrl = process.env.BASE_URL || 'https://www.myapiai.com';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer: customer.stripe_customer_id,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'MyApi AI credits', description: `${amount} credits ($${(amount / 100).toFixed(2)})` },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    success_url: `${baseUrl}/dashboard/automations?topup=success`,
    cancel_url: `${baseUrl}/dashboard/automations?topup=canceled`,
    metadata: { kind: 'ai_topup', user_id: String(userId), credits: String(amount) },
    payment_intent_data: { setup_future_usage: 'off_session' }, // save the card for auto-reload
  });
  return { ok: true, url: session.url };
}

module.exports = {
  getWallet, saveWallet, addCredits, spendStatus, canRunPlatform,
  deductForRun, maybeAlert, attemptAutoReload, createTopUpCheckout,
};
