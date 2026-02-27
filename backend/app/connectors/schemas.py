from pydantic import BaseModel
from datetime import datetime


class ConnectorCreate(BaseModel):
    service_type: str
    label: str
    config_json: str = "{}"
    oauth_token: str = ""


class ConnectorOut(BaseModel):
    id: int
    service_type: str
    label: str
    status: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True
