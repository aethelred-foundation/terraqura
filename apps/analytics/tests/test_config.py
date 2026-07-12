"""Configuration tests for manifest-backed network settings."""

from __future__ import annotations

import pytest

from terraqura_analytics.config import LEGACY_VALIDATION_OPT_IN_ENV, Settings


def test_settings_resolve_mainnet_from_portable_manifest(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TERRAQURA_NETWORK", raising=False)
    monkeypatch.delenv("TERRAQURA_DEPLOYMENT", raising=False)
    monkeypatch.delenv("TERRAQURA_CHAIN_ID", raising=False)
    monkeypatch.delenv("CHAIN_ID", raising=False)
    monkeypatch.delenv(LEGACY_VALIDATION_OPT_IN_ENV, raising=False)

    settings = Settings()

    assert settings.network_key == "aethelred"
    assert settings.deployment_key == "aethelredMainnetPending"
    assert settings.chain_id == 7331
    assert settings.rpc_url == "https://evm-rpc.aethelred.network"


def test_settings_resolve_testnet_from_portable_manifest(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TERRAQURA_NETWORK", "aethelredTestnet")
    monkeypatch.delenv("TERRAQURA_DEPLOYMENT", raising=False)
    monkeypatch.delenv("TERRAQURA_CHAIN_ID", raising=False)
    monkeypatch.delenv("CHAIN_ID", raising=False)
    monkeypatch.delenv(LEGACY_VALIDATION_OPT_IN_ENV, raising=False)

    settings = Settings()

    assert settings.network_key == "aethelredTestnet"
    assert settings.deployment_key == "aethelredTestnetPending"
    assert settings.chain_id == 7332
    assert settings.rpc_url == "https://evm-rpc-testnet.aethelred.network"


def test_settings_reject_chain_id_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TERRAQURA_NETWORK", "aethelredTestnet")
    monkeypatch.setenv("TERRAQURA_CHAIN_ID", "7331")

    with pytest.raises(ValueError, match="does not match"):
        Settings()


def test_settings_reject_legacy_validation_network_without_opt_in(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TERRAQURA_NETWORK", "polygonAmoy")
    monkeypatch.delenv(LEGACY_VALIDATION_OPT_IN_ENV, raising=False)

    with pytest.raises(ValueError, match="legacy validation evidence"):
        Settings()


def test_settings_allow_legacy_validation_network_with_explicit_opt_in(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TERRAQURA_NETWORK", "polygonAmoy")
    monkeypatch.setenv(LEGACY_VALIDATION_OPT_IN_ENV, "true")

    settings = Settings()

    assert settings.network_key == "polygonAmoy"
    assert settings.deployment_key == "polygonAmoyV3Final"
    assert settings.chain_id == 80002
