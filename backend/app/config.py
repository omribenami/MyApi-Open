from pydantic_settings import BaseSettings
from cryptography.fernet import Fernet
import os


class Settings(BaseSettings):
    database_url: str = "sqlite:///./myapi.db"
    jwt_secret: str = "super-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    vault_encryption_key: str = ""
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

    def get_fernet(self) -> Fernet:
        key = self.vault_encryption_key
        if not key:
            key = Fernet.generate_key().decode()
            # persist so restarts don't lose data
            with open(os.path.join(os.path.dirname(__file__), "..", ".env"), "a") as f:
                f.write(f"\nVAULT_ENCRYPTION_KEY={key}\n")
            self.vault_encryption_key = key
        return Fernet(key.encode() if isinstance(key, str) else key)


settings = Settings()
