from pydantic import BaseModel


class IdentityDocOut(BaseModel):
    id: int
    doc_type: str
    content: str

    class Config:
        from_attributes = True


class IdentityDocUpdate(BaseModel):
    content: str
