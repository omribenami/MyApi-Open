from pydantic import BaseModel
from datetime import datetime


class VaultTokenCreate(BaseModel):
    label: str
    description: str = ""
    value: str  # plaintext, will be encrypted
    service_type: str = "generic"


class VaultTokenOut(BaseModel):
    id: int
    label: str
    description: str
    service_type: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True
