# Marketplace Migration Notes (v2)

## Migration strategy
Migration is in `initDatabase()` via `runMarketplaceV2Migrations()` in `src/database.js`.

Approach:
1. Additive `ALTER TABLE` only (safe for existing DB)
2. Backfill data from legacy columns
3. Add indexes for new filters
4. Keep old fields/API behavior

## Added columns
- product/provenance: `product_type`, `provider_name`, `official`, `verified_source`, `source_url`, `origin_type`, `origin_listing_id`, `origin_owner`, `license`
- pricing/monetization: `pricing_model`, `price_cents`, `currency`
- lifecycle/visibility: `visibility`, extended `status`
- metadata: `compatibility`, `capabilities`, `trust_score`

## Backfill rules
- `product_type = COALESCE(product_type, type, 'skill')`
- `pricing_model` inferred from `price`
- `price_cents` parsed from `price` where possible
- `currency = 'USD'` default
- `visibility = 'public'` default
- `origin_type` inferred from `official`
- `status` normalized to `draft|active|archived|removed`

## Rollback guidance
No destructive changes were made, so rollback is app-level:
- Stop using new query params/fields
- Continue consuming `type/content/price/status/install_count/rating_*`
- Optional: ignore new columns

(Physical column removal in SQLite requires table rebuild and is intentionally avoided.)

## Validation checklist
- [x] Existing listings still list/install/rate
- [x] New filters work (`type/field/provider/official/sort`)
- [x] Install idempotency preserved for skills
- [x] UI handles paid products with non-breaking placeholder

## Notes
Global Jest suite in repo currently has pre-existing failures unrelated to this migration (device/workspace test setup). Frontend production build passes.
