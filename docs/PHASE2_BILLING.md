# Phase 2 — Billing & Usage Tracking

## Overview
Phase 2 adds workspace-scoped billing and daily usage tracking with Stripe-safe fallbacks.

## Database Schema
Added tables:

- `billing_customers`
  - `workspace_id`, `stripe_customer_id`, `email`, `created_at`
- `billing_subscriptions`
  - `workspace_id`, `stripe_subscription_id`, `plan_id`, `status`, `period_start`, `period_end`, `cancel_at_period_end`, timestamps
- `usage_daily`
  - `workspace_id`, `date`, `api_calls`, `installs`, `ratings`, `active_services`, timestamps
- `invoices`
  - `workspace_id`, `stripe_invoice_id`, `amount_cents`, `currency`, `status`, `invoice_url`, `created_at`

Indexes added for workspace/date lookups and invoice listing.

## Plan Model & Limits
Canonical plans live in `src/lib/billing.js`:

- `free`
- `pro`
- `enterprise`

Helpers:
- `resolveWorkspaceCurrentPlan(subscriptionRow)` → defaults to `free` if no subscription
- `computeUsageVsLimits(plan, usageTotals)`
- `getRangeDays(range)` for `7d|30d`

## API Endpoints
Workspace-scoped endpoints:

- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/current`
- `POST /api/v1/billing/checkout`
- `POST /api/v1/billing/webhook`
- `GET /api/v1/billing/invoices`
- `GET /api/v1/billing/usage?range=7d|30d`
- `POST /api/v1/billing/portal`

Behavior:
- If Stripe is not configured, billing endpoints return non-crashing explicit messages.
- Checkout still persists local subscription/customer data in mock-safe mode.

## Usage Instrumentation
Daily aggregate updates (`usage_daily`) are written on:

- API proxy execution (`api_calls` + active services snapshot)
- Marketplace install (`installs`)
- Marketplace rating/review (`ratings`)
- OAuth connect/disconnect (active services snapshot)

## Frontend
`Settings > Plans` section now displays:

- Current plan
- Usage bars (API calls, services, installs, ratings)
- Upgrade/plan switch actions
- Invoice list
- Graceful unconfigured billing state

## Notes
Webhook signature verification requires raw-body middleware. Current implementation returns a strict misconfiguration response when secret is set but raw body is unavailable.
