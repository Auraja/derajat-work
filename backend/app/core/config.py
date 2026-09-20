from functools import lru_cache
from ipaddress import ip_network
from typing import Annotated

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_DEFAULT_SECRET = "development-only-change-this-secret-key"
_PLACEHOLDER_SECRETS = {
    _DEFAULT_SECRET,
    "ganti_dengan_secret_acak_minimal_32_byte",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="DERAJAT_", env_file=".env", extra="ignore", populate_by_name=True
    )

    app_name: str = Field(
        default="Derajat Work API",
        validation_alias=AliasChoices("APP_NAME", "DERAJAT_APP_NAME"),
    )
    environment: str = Field(
        default="development",
        validation_alias=AliasChoices("APP_ENV", "DERAJAT_ENVIRONMENT"),
    )
    database_url: str = Field(
        default="sqlite:///./derajat_work.db",
        validation_alias=AliasChoices("DATABASE_URL", "DERAJAT_DATABASE_URL"),
    )
    secret_key: SecretStr = Field(
        default=SecretStr(_DEFAULT_SECRET),
        validation_alias=AliasChoices("APP_SECRET_KEY", "DERAJAT_SECRET_KEY"),
    )
    access_token_expire_minutes: int = 60 * 8
    cookie_name: str = "derajat_session"
    cookie_secure: bool = Field(
        default=False,
        validation_alias=AliasChoices("COOKIE_SECURE", "DERAJAT_COOKIE_SECURE"),
    )
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        validation_alias=AliasChoices("CORS_ORIGINS", "DERAJAT_CORS_ORIGINS"),
    )
    trusted_proxy_cidrs: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        validation_alias=AliasChoices("TRUSTED_PROXY_CIDRS", "DERAJAT_TRUSTED_PROXY_CIDRS"),
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        values = value.split(",") if isinstance(value, str) else value
        if not isinstance(values, list):
            raise ValueError("CORS origins must be a comma-separated string or list")
        origins = list(dict.fromkeys(str(item).strip() for item in values if str(item).strip()))
        if "*" in origins:
            raise ValueError("Wildcard CORS origin is not allowed")
        return origins

    @field_validator("trusted_proxy_cidrs", mode="before")
    @classmethod
    def parse_trusted_proxy_cidrs(cls, value: object) -> list[str]:
        values = value.split(",") if isinstance(value, str) else value
        if not isinstance(values, list):
            raise ValueError("Trusted proxy CIDRs must be a comma-separated string or list")
        networks = list(dict.fromkeys(str(item).strip() for item in values if str(item).strip()))
        for network in networks:
            ip_network(network)
        return networks

    @model_validator(mode="after")
    def require_production_secret(self) -> "Settings":
        secret = self.secret_key.get_secret_value()
        if self.environment.lower() == "production" and (
            len(secret) < 32 or secret.lower() in _PLACEHOLDER_SECRETS
        ):
            raise ValueError("DERAJAT_SECRET_KEY must be a unique secret of at least 32 characters")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
