"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from terraqura_analytics import __version__
from terraqura_analytics.api.routes import create_router
from terraqura_analytics.config import get_settings


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="TerraQura Analytics",
        description="Analytics and ML service for the TerraQura carbon credit platform on Aethelred.",
        version=__version__,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(create_router(), prefix=settings.api_prefix)

    return app
