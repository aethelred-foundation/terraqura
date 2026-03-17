"""Application configuration via pydantic-settings."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Global application settings loaded from environment variables."""

    # API
    api_url: str = "http://localhost:3001"
    api_prefix: str = "/api/v1"
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./terraqura_analytics.db"

    # ML models
    model_path: str = "./models"

    # Blockchain RPC
    rpc_url: str = "https://rpc.aethelred.network"
    chain_id: int = 1

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_prefix": "TQ_", "env_file": ".env", "extra": "ignore"}


def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
