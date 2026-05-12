from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings

_WEAK_SECRETS: frozenset[str] = frozenset({
    "change-me",
    "change-me-in-production",
    "change-me-for-docker-use",
    "secret",
    "password",
    "default",
    "dev-secret",
    "jwt-secret",
    "your-secret-key",
    "your_secret_key",
    "mysecret",
    "test",
    "1234",
    "abcd",
})


class Settings(BaseSettings):
    app_name: str = "Aegis Lite"
    aegis_edition: str = "lite"
    debug: bool = False
    local_dev: bool = False

    database_url: str = "sqlite+aiosqlite:///./aegis_lite.db"

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    openrouter_api_key: str = ""
    perplexity_api_key: str = ""

    default_monthly_budget: float = 20.0

    # Must be a strong random value (≥ 32 chars) in production.
    # Generate with: openssl rand -hex 32
    secret_key: str = "change-me-in-production"

    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # Demo mode — enables seeded public-safe data, disables sensitive exposure.
    # Set DEMO_MODE=true in .env for the public demo deployment.
    demo_mode: bool = False

    # Public site URL — used in demo mode for CORS and status links.
    public_url: str = "http://localhost:3000"

    # Deployment metadata — surfaced in /status (never exposes secrets).
    deployment_name: str = "local"

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """Reject weak secrets when running in production (not local_dev, not debug)."""
        if self.local_dev or self.debug or self.demo_mode:
            return self

        normalized = self.secret_key.lower().strip()
        is_weak = (
            normalized in _WEAK_SECRETS
            or any(normalized.startswith(w) for w in _WEAK_SECRETS)
            or len(self.secret_key) < 32
        )
        if is_weak:
            raise ValueError(
                "SECRET_KEY is weak or default — startup blocked in production mode. "
                "Set a strong random value (openssl rand -hex 32) in your .env file. "
                "To allow weak secrets in development, set LOCAL_DEV=true in .env."
            )
        return self

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
