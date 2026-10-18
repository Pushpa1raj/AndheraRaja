from functools import lru_cache
from typing import Annotated

from pydantic import AnyHttpUrl, BeforeValidator, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_origins(value: object) -> list[str]:
    if isinstance(value, str):
        return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
    if isinstance(value, list):
        return [str(origin).strip().rstrip("/") for origin in value]
    raise ValueError("CORS_ORIGINS must be a comma-separated string or list")


CorsOrigins = Annotated[list[str] | str, BeforeValidator(parse_origins)]


class Settings(BaseSettings):
    """Runtime configuration. Never expose service or encryption keys to Next.js."""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    project_name: str = "Andhera Raja API"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/postgres"
    supabase_url: str = ""
    supabase_jwt_issuer: str = ""
    supabase_jwt_audience: str = "authenticated"
    supabase_jwks_url: str = ""
    # Only FastAPI may use this key. It is intentionally not required for local
    # test execution and must not be copied into a NEXT_PUBLIC environment file.
    supabase_service_role_key: str = ""
    # Development-only fallback. Production must use JWKS verification.
    supabase_jwt_secret: str = ""

    cors_origins: CorsOrigins = Field(default_factory=lambda: ["http://localhost:3000"])
    encryption_key: str = ""
    request_rate_limit_per_minute: int = Field(default=60, ge=1, le=10_000)
    game_rate_limit_per_minute: int = Field(default=120, ge=1, le=10_000)

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.cors_origins, list):
            return self.cors_origins
        return [str(self.cors_origins)]

    @property
    def PROJECT_NAME(self) -> str:
        return self.project_name

    @property
    def API_V1_PREFIX(self) -> str:
        return self.api_v1_prefix

    @property
    def DATABASE_URL(self) -> str:
        return self.database_url

    @property
    def ENCRYPTION_KEY(self) -> str:
        if not self.encryption_key:
            from cryptography.fernet import Fernet
            return Fernet.generate_key().decode()
        return self.encryption_key

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def resolved_jwt_issuer(self) -> str:
        return self.supabase_jwt_issuer or (f"{self.supabase_url.rstrip('/')}/auth/v1" if self.supabase_url else "")

    @property
    def resolved_jwks_url(self) -> str:
        return self.supabase_jwks_url or (f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json" if self.supabase_url else "")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production and not (settings.resolved_jwks_url and settings.resolved_jwt_issuer):
        raise RuntimeError("Production requires SUPABASE_URL or explicit Supabase JWT issuer/JWKS configuration")
    if settings.is_production and not settings.encryption_key:
        raise RuntimeError("Production requires ENCRYPTION_KEY for provably-fair server seeds")
    return settings


settings = get_settings()
