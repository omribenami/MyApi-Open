from pydantic import BaseModel
from datetime import datetime


class HandshakeRequest(BaseModel):
    user_id: int
    agent_id: str
    requested_scopes: str = "*"
    message: str = ""


class HandshakeOut(BaseModel):
    id: int
    agent_id: str
    requested_scopes: str
    message: str
    status: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True
