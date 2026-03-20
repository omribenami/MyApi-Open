# fal integration (MVP)

MyApi supports **fal HTTP API integration** with API key auth (no OAuth).

## Auth model
- Per-user key (recommended): save in service preferences under `fal_api_key`
- Global fallback: set `FAL_API_KEY` in server env

Priority: per-user key > global env key.

## Supported methods
- `list_models` → `GET https://fal.run/models`
- `generate_image` → `POST https://queue.fal.run/fal-ai/fast-sdxl` with `{ "prompt": "..." }`
- `generate_video` → currently stubbed as unsupported (HTTP 501)

## Dashboard flow
1. Open **Services** → **fal**
2. Click **Connect** / **Update API Key**
3. Enter `fal_api_key` and save
4. Run **Test Connection**

## API examples

### Save key
```bash
curl -X POST http://localhost:4500/api/v1/services/preferences/fal \
  -H 'Authorization: Bearer <MYAPI_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"preferences":{"fal_api_key":"key_xxx","default_image_model":"fal-ai/fast-sdxl"}}'
```

### Execute: list models
```bash
curl -X POST http://localhost:4500/api/v1/services/fal/execute \
  -H 'Authorization: Bearer <MYAPI_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"method":"list_models","params":{}}'
```

### Execute: generate image
```bash
curl -X POST http://localhost:4500/api/v1/services/fal/execute \
  -H 'Authorization: Bearer <MYAPI_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"method":"generate_image","params":{"prompt":"cinematic astronaut in neon city"}}'
```

### Proxy call
```bash
curl -X POST http://localhost:4500/api/v1/services/fal/proxy \
  -H 'Authorization: Bearer <MYAPI_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"path":"/models","method":"GET"}'
```

## Security notes
- API keys are never returned in response payloads
- Test endpoint validates connection without exposing secrets
- Audit logging tracks actions and status, not secret values

## MCP path (phase 2)
This MVP uses robust fal HTTP APIs only. MCP transport/tooling can be added in phase-2 if product requires direct MCP protocol support.
