# Marketplace Product Model (v2)

## Goals
Supports:
- Official verified products
- Origin/provenance
- Idempotent installs
- Ratings/reviews
- Monetization-ready pricing fields
- Backward compatibility with existing `type/content/price` records

## Listing schema (marketplace_listings)
New/normalized fields:
- `product_type` (`skill|persona|api|template|connector`)
- `provider_name` (string)
- `official` (0/1)
- `verified_source` (0/1)
- `source_url` (nullable URL)
- `origin_type` (`official|community|fork`)
- `origin_listing_id` (nullable int)
- `origin_owner` (nullable string)
- `license` (nullable string)
- `pricing_model` (`free|one_time|subscription`)
- `price_cents` (nullable int)
- `currency` (default `USD`)
- `visibility` (`public|private|unlisted`)
- `status` (`draft|active|archived|removed`)
- `compatibility` (JSON string)
- `capabilities` (JSON string)
- `trust_score` (REAL)

Legacy fields kept:
- `type`, `content`, `tags`, `price`, rating/install counters

## API contracts

### List products
`GET /api/v1/marketplace`

Query params:
- `type`
- `product_type`
- `field` (maps to tags)
- `tag` (maps to tags)
- `tags`
- `provider`
- `official=true|false`
- `pricing=free|paid`
- `visibility`
- `status`
- `search`
- `sort=popular|recent|rating`

Response:
```json
{
  "listings": [
    {
      "id": 101,
      "title": "Web Design Critic",
      "type": "skill",
      "productType": "skill",
      "providerName": "OpenAI",
      "official": true,
      "verifiedSource": true,
      "originType": "official",
      "pricingModel": "free",
      "priceCents": null,
      "currency": "USD",
      "installCount": 42,
      "avgRating": 4.8,
      "ratingCount": 12,
      "tags": ["web design", "ux"]
    }
  ],
  "summary": {
    "total": 1,
    "skills": 1,
    "personas": 0,
    "apis": 0
  }
}
```

### Product details
`GET /api/v1/marketplace/:id`

Includes full listing + `ratings[]`.

### Create product
`POST /api/v1/marketplace` (auth)

Accepts old shape (`type,title,description,content,tags,price`) and new fields.

### Update product
`PUT /api/v1/marketplace/:id` (auth)

### Publish/unpublish/archive
`PATCH /api/v1/marketplace/:id/status` (auth)
```json
{ "status": "active" }
```

### Remove
`DELETE /api/v1/marketplace/:id` (auth)
Sets `status=removed`.

### Install (idempotent)
`POST /api/v1/marketplace/:id/install` (auth)
- Skills: idempotent by `config_json.marketplace_listing_id`
- API products: provisions local service + methods
- Paid products: frontend shows “coming soon” placeholder

### Rate/review
`POST /api/v1/marketplace/:id/rate` (auth)
```json
{ "rating": 5, "review": "Great package" }
```

### Ownership transfer placeholder
`POST /api/v1/marketplace/:id/transfer` (auth)
```json
{ "toOwnerId": "usr_xxx", "dryRun": true }
```

### Providers for filter dropdown
`GET /api/v1/marketplace/providers`

## Sorting semantics
- `popular`: `install_count DESC`, then `avg_rating DESC`, then `rating_count DESC`
- `recent`: `created_at DESC`
- `rating`: `avg_rating DESC`, then `rating_count DESC`, then `install_count DESC`

## Backward compatibility mapping
- `product_type <- COALESCE(product_type, type)`
- `pricing_model <- price` (`free` => `free`, else inferred)
- `price_cents` inferred from string price when possible
- `origin_type` inferred from `official`
- legacy `price` still returned
