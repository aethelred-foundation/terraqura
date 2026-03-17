"""Entry point for the TerraQura Analytics service."""

from __future__ import annotations

import uvicorn

from terraqura_analytics.api.app import create_app
from terraqura_analytics.config import get_settings


def main() -> None:
    """Start the uvicorn server."""
    settings = get_settings()
    app = create_app()
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level="debug" if settings.debug else "info",
    )


if __name__ == "__main__":
    main()
