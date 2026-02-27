import json
from sqlalchemy.orm import Session
from app.models import AuditLog


def log_action(db: Session, user_id: int | None, action: str, resource: str = "", ip: str = "", details: dict | None = None):
    entry = AuditLog(user_id=user_id, action=action, resource=resource, ip=ip, details_json=json.dumps(details or {}))
    db.add(entry)
    db.commit()
