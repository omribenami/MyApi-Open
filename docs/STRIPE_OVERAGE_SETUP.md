# Pro API-call overage — Stripe setup

The code to meter and bill Pro overage ($0.25 per 1,000 calls beyond the 10,000
included/month) is shipped and **dormant until you create the meter + metered
price in Stripe and set two env vars**. Nothing breaks before that — checkout,
the dashboard overage display, and the quota logic all work without it.

## One-time Stripe dashboard setup

1. **Create a Billing Meter** (Stripe Dashboard → Billing → Meters):
   - Event name: `myapi_api_calls` (any value; must match env below)
   - Aggregation: **Sum**
   - Customer mapping: `stripe_customer_id`
   - Value setting / payload key: `value`

2. **Create a graduated metered price** on the existing **Pro** product:
   - Pricing model: **Graduated**, billed by the meter above
   - Tier 1: first **10000** units = **$0**
   - Tier 2: **10001+** = **$0.00025 per unit** (= $0.25 per 1,000)
   - Copy the price id (`price_…`).

3. **Set env vars** (root `.env`):
   ```
   STRIPE_OVERAGE_METER_EVENT_NAME=myapi_api_calls
   STRIPE_PRICE_ID_PRO_OVERAGE_LIVE=price_xxx   # the graduated price id
   # (STRIPE_PRICE_ID_PRO_OVERAGE for test mode)
   ```
   Restart the server. On boot you'll see `✅ Stripe overage metering scheduled`.

## What happens after

- New Pro checkouts include the metered price as a second subscription item
  (the flat $9 base + the metered overage item). Existing Pro subs need the
  metered item added once (via Stripe dashboard or a `subscriptions.update`).
- A background job (every 6h, and on boot) reports each completed day's
  `api_calls` to the meter per Pro workspace, exactly once
  (`usage_daily.meter_reported_at` guards against double-reporting).
- Stripe applies the 10k free tier and bills only the overage on the invoice.

## Notes
- Personal hard-caps at quota (429); Heavy is unlimited — neither meters.
- Reporting raw daily totals is correct: the graduated price encodes the free
  tier, so the app never computes overage itself.
- Code: `src/lib/overageReporter.js`, checkout wiring in `src/index.js`,
  schedule next to retention cleanup. Tests: `src/tests/overage-reporter.test.js`.
