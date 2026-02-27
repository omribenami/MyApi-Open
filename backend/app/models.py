from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(120), default="")
    hashed_password = Column(String(255), nullable=False)
    timezone = Column(String(50), default="UTC")
    created_at = Column(DateTime, server_default=func.now())


class IdentityDoc(Base):
    __tablename__ = "identity_docs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doc_type = Column(String(30), nullable=False)  # user_md, soul_md, memory_md
    content = Column(Text, default="")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class VaultToken(Base):
    __tablename__ = "vault_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    label = Column(String(120), nullable=False)
    description = Column(String(500), default="")
    encrypted_value = Column(Text, nullable=False)
    service_type = Column(String(60), default="generic")
    created_at = Column(DateTime, server_default=func.now())


class Connector(Base):
    __tablename__ = "connectors"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    service_type = Column(String(60), nullable=False)
    label = Column(String(120), nullable=False)
    config_json = Column(Text, default="{}")
    oauth_token_encrypted = Column(Text, default="")
    status = Column(String(20), default="active")
    created_at = Column(DateTime, server_default=func.now())


class Persona(Base):
    __tablename__ = "personas"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(120), nullable=False)
    soul_md = Column(Text, default="")
    skills_json = Column(Text, default="[]")
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class AccessToken(Base):
    __tablename__ = "access_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True)
    scope = Column(String(500), default="*")
    label = Column(String(120), default="")
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Handshake(Base):
    __tablename__ = "handshakes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(String(255), nullable=False)
    requested_scopes = Column(String(500), default="*")
    message = Column(Text, default="")
    status = Column(String(20), default="pending")
    token_id = Column(Integer, ForeignKey("access_tokens.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    action = Column(String(120), nullable=False)
    resource = Column(String(255), default="")
    ip = Column(String(45), default="")
    details_json = Column(Text, default="{}")
    created_at = Column(DateTime, server_default=func.now())
