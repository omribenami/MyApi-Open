from sqlalchemy.orm import Session
from app.models import User, IdentityDoc, Persona, Connector


def assemble_context(db: Session, user: User) -> dict:
    docs = db.query(IdentityDoc).filter(IdentityDoc.user_id == user.id).all()
    identity = {d.doc_type: d.content for d in docs}

    persona = db.query(Persona).filter(Persona.user_id == user.id, Persona.is_active == True).first()
    persona_data = None
    if persona:
        persona_data = {"name": persona.name, "soul_md": persona.soul_md, "skills": persona.skills_json}

    connectors = db.query(Connector).filter(Connector.user_id == user.id, Connector.status == "active").all()
    services = [c.service_type for c in connectors]

    return {
        "identity": {"user_md": identity.get("user_md", ""), "soul_md": identity.get("soul_md", "")},
        "persona": persona_data,
        "available_services": services,
        "memory": identity.get("memory_md", ""),
        "preferences": {"timezone": user.timezone, "display_name": user.display_name},
    }
