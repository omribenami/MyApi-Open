from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, IdentityDoc
from app.auth.dependencies import get_current_user
from app.identity.schemas import IdentityDocOut, IdentityDocUpdate

router = APIRouter(prefix="/api/v1/identity", tags=["identity"])
VALID_TYPES = ["user_md", "soul_md", "memory_md"]


@router.get("", response_model=list[IdentityDocOut])
def list_docs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(IdentityDoc).filter(IdentityDoc.user_id == user.id).all()
    # Ensure all doc types exist
    existing = {d.doc_type for d in docs}
    for dt in VALID_TYPES:
        if dt not in existing:
            doc = IdentityDoc(user_id=user.id, doc_type=dt, content="")
            db.add(doc)
            docs.append(doc)
    db.commit()
    return docs


@router.put("/{doc_type}", response_model=IdentityDocOut)
def update_doc(doc_type: str, body: IdentityDocUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if doc_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid doc_type. Must be one of {VALID_TYPES}")
    doc = db.query(IdentityDoc).filter(IdentityDoc.user_id == user.id, IdentityDoc.doc_type == doc_type).first()
    if not doc:
        doc = IdentityDoc(user_id=user.id, doc_type=doc_type, content=body.content)
        db.add(doc)
    else:
        doc.content = body.content
    db.commit()
    db.refresh(doc)
    return doc
