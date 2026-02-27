from pydantic import BaseModel
from datetime import datetime


class TokenCreate(BaseModel):
    scope: str = "*"
    label: str = ""
    expires_in_days: int | None = 30


class TokenOut(BaseModel):
    id: int
    scope: str
    label: str
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class TokenCreated(TokenOut):
    raw_token: str  # only shown once at creation
