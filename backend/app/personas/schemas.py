from pydantic import BaseModel
from datetime import datetime


class PersonaCreate(BaseModel):
    name: str
    soul_md: str = ""
    skills_json: str = "[]"


class PersonaUpdate(BaseModel):
    name: str | None = None
    soul_md: str | None = None
    skills_json: str | None = None


class PersonaOut(BaseModel):
    id: int
    name: str
    soul_md: str
    skills_json: str
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True
