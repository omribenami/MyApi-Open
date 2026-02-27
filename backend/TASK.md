# MyAPI Gateway — Python/FastAPI Backend Build

## What You're Building
A personal AI middleware gateway. ONE token gives AI platforms access to all user services, identity, and personas.

## Tech Stack
- Python 3.10+, FastAPI, SQLAlchemy (SQLite), Pydantic v2
- Auth: PyJWT + bcrypt + refresh tokens
- Encryption: Fernet (cryptography) for vault secrets
- CORS, rate limiting, audit logging

## Structure to Create
```
app/
├── __init__.py
├── main.py              # FastAPI app, mount routers, CORS, startup
├── config.py            # Pydantic Settings (env-based)
├── database.py          # SQLAlchemy engine, session, Base
├── models.py            # All SQLAlchemy models
├── auth/
│   ├── __init__.py
│   ├── router.py        # register, login, refresh, me
│   ├── jwt_handler.py   # create/verify JWT
│   └── dependencies.py  # get_current_user dependency
├── identity/
│   ├── __init__.py
│   ├── router.py        # CRUD for identity docs (USER.md, SOUL.md, MEMORY.md)
│   └── schemas.py       # Pydantic request/response models
├── vault/
│   ├── __init__.py
│   ├── router.py        # Store/list/delete encrypted service tokens
│   ├── encryption.py    # Fernet encrypt/decrypt helpers
│   └── schemas.py
├── personas/
│   ├── __init__.py
│   ├── router.py        # CRUD personas (name, soul_md, skills, active flag)
│   └── schemas.py
├── connectors/
│   ├── __init__.py
│   ├── router.py        # Add/list/remove/proxy service connectors
│   └── schemas.py
├── gateway/
│   ├── __init__.py
│   ├── router.py        # /context (assembled AI context), /proxy/{service}, /whoami
│   └── brain.py         # Context assembly logic
├── tokens/
│   ├── __init__.py
│   ├── router.py        # Guest token CRUD + scoped access
│   └── schemas.py
├── handshakes/
│   ├── __init__.py
│   ├── router.py        # Agent access request flow
│   └── schemas.py
├── audit/
│   ├── __init__.py
│   ├── router.py        # Query audit log
│   └── service.py       # Log creation helper
└── middleware.py         # Rate limiting, audit middleware
```

Also create:
- `requirements.txt` with all deps
- `.env.example`
- `run.sh` (chmod +x) that installs deps in venv + starts uvicorn on port 4501

## SQLAlchemy Models
1. **User**: id, username, email, display_name, hashed_password, timezone, created_at
2. **IdentityDoc**: id, user_id, doc_type (user_md/soul_md/memory_md), content (text), updated_at
3. **VaultToken**: id, user_id, label, description, encrypted_value, service_type, created_at
4. **Connector**: id, user_id, service_type, label, config_json (encrypted), oauth_token_encrypted, status, created_at
5. **Persona**: id, user_id, name, soul_md, skills_json, is_active, created_at
6. **AccessToken**: id, user_id, token_hash, scope, label, expires_at, revoked_at, created_at
7. **Handshake**: id, user_id, agent_id, requested_scopes, message, status, token_id, created_at, updated_at
8. **AuditLog**: id, user_id, action, resource, ip, details_json, created_at

## Security Requirements
- All vault/connector secrets: Fernet encrypted at rest
- JWT access tokens: 15 min expiry; refresh tokens: 7 days
- Rate limit: 60 req/min per IP
- Audit log every authenticated action
- Never return raw secrets in API responses
- CORS configurable via env

## Gateway /context Endpoint (The Key Feature)
When an AI calls `GET /api/v1/gateway/context`, it returns:
```json
{
  "identity": { "user_md": "...", "soul_md": "..." },
  "persona": { "name": "Jarvis", "soul_md": "...", "skills": [...] },
  "available_services": ["google_calendar", "todoist", "whatsapp"],
  "memory": "...",
  "preferences": {...}
}
```
This is the assembled context package that makes ANY AI behave like the user's configured assistant.

## Frontend
Also build a React + Vite + Tailwind frontend in `../frontend/`:
- Login/Register page
- Dashboard with sidebar nav
- Pages: Identity (markdown editors), Vault (add/list tokens), Connectors (add/manage), Personas (CRUD), Tokens (guest token management), Handshakes (approve/deny), Audit Log (table)
- Use fetch() to call the backend at http://localhost:4501
- Modern dark theme, clean UI

## Run Instructions
After building, run `bash run.sh` to verify it starts. The server must be accessible on port 4501.

When completely finished, run this command to notify me:
openclaw system event --text "Done: MyAPI FastAPI backend + React frontend built and running on port 4501" --mode now
