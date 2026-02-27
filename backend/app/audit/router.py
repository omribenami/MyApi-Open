from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, AuditLog
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("")
def get_audit_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog).filter(AuditLog.user_id == user.id)
    if action:
        q = q.filter(AuditLog.action == action)
    logs = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {"id": l.id, "action": l.action, "resource": l.resource, "ip": l.ip, "details": l.details_json, "created_at": str(l.created_at)}
        for l in logs
    ]
