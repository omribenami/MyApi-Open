from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.database import engine, Base
from app.middleware import limiter
from app.auth.router import router as auth_router
from app.identity.router import router as identity_router
from app.vault.router import router as vault_router
from app.connectors.router import router as connectors_router
from app.personas.router import router as personas_router
from app.tokens.router import router as tokens_router
from app.handshakes.router import router as handshakes_router
from app.audit.router import router as audit_router
from app.gateway.router import router as gateway_router
from app.audit.service import log_action
from app.database import SessionLocal

app = FastAPI(title="MyAPI Gateway", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    response = await call_next(request)
    # Log authenticated actions (non-auth, non-docs endpoints)
    if request.url.path.startswith("/api/v1/") and not request.url.path.startswith("/api/v1/auth"):
        try:
            auth = request.headers.get("authorization", "")
            if auth:
                db = SessionLocal()
                try:
                    from app.auth.jwt_handler import decode_token
                    token = auth.replace("Bearer ", "")
                    payload = decode_token(token)
                    if payload:
                        log_action(db, payload.get("sub"), request.method, request.url.path, request.client.host if request.client else "")
                finally:
                    db.close()
        except Exception:
            pass
    return response


app.include_router(auth_router)
app.include_router(identity_router)
app.include_router(vault_router)
app.include_router(connectors_router)
app.include_router(personas_router)
app.include_router(tokens_router)
app.include_router(handshakes_router)
app.include_router(audit_router)
app.include_router(gateway_router)


@app.get("/")
def root():
    return {"name": "MyAPI Gateway", "version": "1.0.0", "docs": "/docs"}
