from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path
from typing import List

BASE_DIR = Path(__file__).parent

_INSECURE_DEFAULT_KEY = "change-me-in-production-use-openssl-rand-hex-32"


class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/bibliotrack.db"
    SECRET_KEY: str = _INSECURE_DEFAULT_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COVERS_DIR: Path = BASE_DIR / "static" / "covers"
    # Comma-separated allowed CORS origins; "*" = allow all (same-origin Docker deployments)
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_secure(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        raw = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return raw if raw else ["*"]

    @property
    def is_insecure_default_key(self) -> bool:
        return self.SECRET_KEY == _INSECURE_DEFAULT_KEY

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
