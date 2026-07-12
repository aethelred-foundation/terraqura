"""Application configuration via pydantic-settings."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings

LEGACY_VALIDATION_OPT_IN_ENV = "TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT"
PUBLIC_LEGACY_VALIDATION_OPT_IN_ENV = "NEXT_PUBLIC_TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT"


def _manifest_candidates(explicit_path: str | None) -> list[Path]:
    candidates: list[Path] = []
    if explicit_path:
        candidates.append(Path(explicit_path))

    env_path = os.getenv("TERRAQURA_NETWORK_MANIFEST_JSON")
    if env_path:
        candidates.append(Path(env_path))

    repo_root = Path(__file__).resolve().parents[4]
    candidates.extend(
        [
            Path.cwd() / "packages/network-manifest/manifest.json",
            Path.cwd().parent.parent / "packages/network-manifest/manifest.json",
            repo_root / "packages/network-manifest/manifest.json",
        ]
    )
    return candidates


def _load_manifest(explicit_path: str | None) -> tuple[dict[str, Any] | None, str | None]:
    for candidate in _manifest_candidates(explicit_path):
        if not candidate.exists():
            continue
        with candidate.open("r", encoding="utf-8") as handle:
            return json.load(handle), str(candidate)
    return None, None


def _deployment_for_network(manifest: dict[str, Any], network_key: str) -> str | None:
    for deployment_key, deployment in manifest.get("deployments", {}).items():
        if deployment.get("network") == network_key:
            return deployment_key
    return None


def _env_chain_id() -> int | None:
    raw = os.getenv("TERRAQURA_CHAIN_ID") or os.getenv("CHAIN_ID")
    if raw is None:
        return None
    return int(raw)


def _legacy_validation_opt_in_enabled() -> bool:
    return (
        os.getenv(LEGACY_VALIDATION_OPT_IN_ENV) == "true"
        or os.getenv(PUBLIC_LEGACY_VALIDATION_OPT_IN_ENV) == "true"
    )


def _assert_runtime_network_allowed(network_key: str, network: dict[str, Any]) -> None:
    if network.get("role") != "legacy-validation":
        return
    if _legacy_validation_opt_in_enabled():
        return
    raise ValueError(
        f"Network {network_key!r} is marked as legacy validation evidence; "
        f"set {LEGACY_VALIDATION_OPT_IN_ENV}=true only for historical validation drills"
    )


class Settings(BaseSettings):
    """Global application settings loaded from environment variables."""

    # API
    api_url: str = "http://localhost:3001"
    api_prefix: str = "/api/v1"
    api_timeout_seconds: float = 2.0
    allow_synthetic_data: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Platform network identity
    network_key: str = "aethelred"
    deployment_key: str | None = None
    network_manifest_path: str | None = None

    # Database
    database_url: str = "sqlite:///./terraqura_analytics.db"

    # ML models
    model_path: str = "./models"

    # Blockchain RPC
    rpc_url: str | None = None
    chain_id: int | None = None

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_prefix": "TQ_", "env_file": ".env", "extra": "ignore"}

    def model_post_init(self, __context: Any) -> None:
        """Resolve chain/RPC settings from the shared TerraQura manifest."""
        manifest, manifest_path = _load_manifest(self.network_manifest_path)

        network_key = os.getenv("TERRAQURA_NETWORK") or self.network_key
        deployment_key = os.getenv("TERRAQURA_DEPLOYMENT") or self.deployment_key
        env_chain_id = _env_chain_id()
        chain_id = env_chain_id if env_chain_id is not None else self.chain_id

        if manifest:
            networks = manifest.get("networks", {})
            network = networks.get(network_key)
            if not network:
                raise ValueError(f"Unknown TerraQura network {network_key!r} in {manifest_path}")
            _assert_runtime_network_allowed(network_key, network)

            if deployment_key is None:
                deployment_key = _deployment_for_network(manifest, network_key)

            if deployment_key is not None:
                deployment = manifest.get("deployments", {}).get(deployment_key)
                if not deployment:
                    raise ValueError(f"Unknown TerraQura deployment {deployment_key!r} in {manifest_path}")
                if deployment.get("network") != network_key:
                    raise ValueError(
                        f"Deployment {deployment_key!r} belongs to {deployment.get('network')!r}, not {network_key!r}"
                    )

            manifest_chain_id = int(network["chainId"])
            if chain_id is not None and chain_id != manifest_chain_id:
                raise ValueError(
                    f"Configured chain_id {chain_id} does not match network {network_key!r} chain ID {manifest_chain_id}"
                )

            self.chain_id = manifest_chain_id
            self.rpc_url = self.rpc_url or network["rpcUrls"][0]
            self.network_manifest_path = manifest_path
        else:
            self.chain_id = chain_id or 7331
            self.rpc_url = self.rpc_url or "https://evm-rpc.aethelred.network"

        self.network_key = network_key
        self.deployment_key = deployment_key or "aethelredMainnetPending"


def get_settings() -> Settings:
    """Return a Settings instance."""
    return Settings()
