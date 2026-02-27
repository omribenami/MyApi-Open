from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.auth.dependencies import get_current_user
from app.gateway.brain import assemble_context

router = APIRouter(prefix="/api/v1/gateway", tags=["gateway"])


@router.get("/context")
@router.post("/context")
def get_context(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return assemble_context(db, user)


@router.get("/whoami")
def whoami(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "display_name": user.display_name}
