import secrets, hashlib
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Handshake, AccessToken
from app.auth.dependencies import get_current_user
from app.handshakes.schemas import HandshakeRequest, HandshakeOut

router = APIRouter(prefix="/api/v1/handshakes", tags=["handshakes"])


@router.post("")
def request_handshake(body: HandshakeRequest, db: Session = Depends(get_db)):
    h = Handshake(user_id=body.user_id, agent_id=body.agent_id, requested_scopes=body.requested_scopes, message=body.message)
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"id": h.id, "status": h.status}


@router.get("", response_model=list[HandshakeOut])
def list_handshakes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Handshake).filter(Handshake.user_id == user.id).order_by(Handshake.created_at.desc()).all()


@router.post("/{hid}/approve")
def approve(hid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(Handshake).filter(Handshake.id == hid, Handshake.user_id == user.id).first()
    if not h or h.status != "pending":
        raise HTTPException(status_code=404, detail="Not found or already processed")
    raw = "myapi_" + secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    t = AccessToken(user_id=user.id, token_hash=token_hash, scope=h.requested_scopes, label=f"agent:{h.agent_id}",
                    expires_at=datetime.now(timezone.utc) + timedelta(days=30))
    db.add(t)
    db.flush()
    h.status = "approved"
    h.token_id = t.id
    db.commit()
    return {"status": "approved", "token": raw}


@router.post("/{hid}/deny")
def deny(hid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    h = db.query(Handshake).filter(Handshake.id == hid, Handshake.user_id == user.id).first()
    if not h or h.status != "pending":
        raise HTTPException(status_code=404, detail="Not found or already processed")
    h.status = "denied"
    db.commit()
    return {"status": "denied"}
