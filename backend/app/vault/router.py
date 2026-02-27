from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, VaultToken
from app.auth.dependencies import get_current_user
from app.vault.schemas import VaultTokenCreate, VaultTokenOut
from app.vault.encryption import encrypt

router = APIRouter(prefix="/api/v1/vault/tokens", tags=["vault"])


@router.get("", response_model=list[VaultTokenOut])
def list_tokens(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(VaultToken).filter(VaultToken.user_id == user.id).all()


@router.post("", response_model=VaultTokenOut)
def create_token(body: VaultTokenCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    token = VaultToken(
        user_id=user.id,
        label=body.label,
        description=body.description,
        encrypted_value=encrypt(body.value),
        service_type=body.service_type,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


@router.delete("/{token_id}")
def delete_token(token_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    token = db.query(VaultToken).filter(VaultToken.id == token_id, VaultToken.user_id == user.id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    db.delete(token)
    db.commit()
    return {"ok": True}
