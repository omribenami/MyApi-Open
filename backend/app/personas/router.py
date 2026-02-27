from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Persona
from app.auth.dependencies import get_current_user
from app.personas.schemas import PersonaCreate, PersonaUpdate, PersonaOut

router = APIRouter(prefix="/api/v1/personas", tags=["personas"])


@router.get("", response_model=list[PersonaOut])
def list_personas(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Persona).filter(Persona.user_id == user.id).all()


@router.post("", response_model=PersonaOut)
def create_persona(body: PersonaCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = Persona(user_id=user.id, name=body.name, soul_md=body.soul_md, skills_json=body.skills_json)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{pid}", response_model=PersonaOut)
def update_persona(pid: int, body: PersonaUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Persona).filter(Persona.id == pid, Persona.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{pid}")
def delete_persona(pid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Persona).filter(Persona.id == pid, Persona.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/{pid}/activate", response_model=PersonaOut)
def activate_persona(pid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Deactivate all, activate this one
    db.query(Persona).filter(Persona.user_id == user.id).update({"is_active": False})
    p = db.query(Persona).filter(Persona.id == pid, Persona.user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    p.is_active = True
    db.commit()
    db.refresh(p)
    return p
