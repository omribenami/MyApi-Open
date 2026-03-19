# Official Marketplace Seed Validation

Date: 2026-03-19

## Execution

Command run:

```bash
node scripts/seed_official_marketplace_skills.js
```

Result summary:

- `insertedCount`: 12
- `skippedCount`: 0
- `totalSeededActive` (for seed tag `official-seed-2026-03-19`): 12

## Database Verification

Validation query (executed):

```sql
select id,title,type,status,tags
from marketplace_listings
where tags like '%official-seed-2026-03-19%'
order by id;
```

Observed:

- 12 rows returned
- all rows have `status = 'active'`
- IDs: 1..12

## Metadata Verification

Checked listing content payload:

- `content.config_json.official = true`
- `content.config_json.verified_source = true`
- `content.config_json.source_url` points to official docs/repo URLs

## Notes

- Seed script is idempotent by `(title + source_url)` matching.
- Listings are inserted via existing supported DB insertion path (`createMarketplaceListing`).
