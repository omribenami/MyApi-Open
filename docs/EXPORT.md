# Export API

## Endpoint

`GET /api/v1/export`

## Query params

- `mode=portable|forensic` (default: `portable`)
- `format=json|zip` (default: `json`)
- `includeFiles=true|false` (ZIP only, default: `false`)
- JSON section toggles: `profile`, `tokens`, `personas`, `knowledge`, `settings`

## Behavior

- **JSON (`format=json`)** keeps legacy v2 behavior and response shape.
- **ZIP (`format=zip`)** returns a portable package with domain-scoped files and checksums.
- Sensitive fields are excluded from ZIP export (no token secrets, hashes, access/refresh tokens).

## ZIP structure

- `manifest.json`
- `profile/identity.json`
- `profile/user.md`
- `profile/soul.md`
- `personas/personas.json`
- `personas/configs/*.json` (when persona config exists)
- `connectors/services.json`
- `connectors/oauth-metadata.json` (metadata only)
- `knowledge/index.json`
- `knowledge/docs/*.md`
- `knowledge/files/*` only when `includeFiles=true` and source files are available
- `settings/settings.json`
- `audit/summary.json`
- `checksums.sha256`

## Examples

```bash
# Legacy JSON export (v2)
curl -H "Authorization: Bearer <token>" \
  "https://www.myapiai.com/api/v1/export?mode=portable"
```

```bash
# ZIP export (v3)
curl -L -H "Authorization: Bearer <token>" \
  "https://www.myapiai.com/api/v1/export?format=zip&mode=portable&includeFiles=false" \
  -o myapi-export.zip
```
