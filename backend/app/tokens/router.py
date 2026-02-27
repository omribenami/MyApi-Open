import secrets, hashlib
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, AccessToken
from app.auth.dependencies import get_current_user
from app.tokens.schemas import TokenCreate, TokenOut, TokenCreated

router = APIRouter(prefix="/api/v1/tokens", tags=["tokens"])


@router.get("", response_model=list[TokenOut])
def list_tokens(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(AccessToken).filter(AccessToken.user_id == user.id).all()


@router.post("", response_model=TokenCreated)
def create_token(body: TokenCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    raw = "myapi_" + secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days) if body.expires_in_days else None
    t = AccessToken(user_id=user.id, token_hash=token_hash, scope=body.scope, label=body.label, expires_at=expires)
    db.add(t)
    db.commit()
    db.refresh(t)
    return TokenCreated(
        id=t.id, scope=t.scope, label=t.label, expires_at=t.expires_at,
        revoked_at=t.revoked_at, created_at=t.created_at, raw_token=raw,
    )


@router.delete("/{token_id}")
def revoke_token(token_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(AccessToken).filter(AccessToken.id == token_id, AccessToken.user_id == user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    t.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
