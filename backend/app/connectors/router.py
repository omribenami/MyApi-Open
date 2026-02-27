from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Connector
from app.auth.dependencies import get_current_user
from app.connectors.schemas import ConnectorCreate, ConnectorOut
from app.vault.encryption import encrypt

router = APIRouter(prefix="/api/v1/connectors", tags=["connectors"])


@router.get("", response_model=list[ConnectorOut])
def list_connectors(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Connector).filter(Connector.user_id == user.id).all()


@router.post("", response_model=ConnectorOut)
def create_connector(body: ConnectorCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = Connector(
        user_id=user.id,
        service_type=body.service_type,
        label=body.label,
        config_json=encrypt(body.config_json),
        oauth_token_encrypted=encrypt(body.oauth_token) if body.oauth_token else "",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{connector_id}")
def delete_connector(connector_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(Connector).filter(Connector.id == connector_id, Connector.user_id == user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(c)
    db.commit()
    return {"ok": True}
