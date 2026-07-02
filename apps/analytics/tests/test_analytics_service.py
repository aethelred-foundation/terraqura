"""Tests for the analytics orchestration service."""

from __future__ import annotations

import httpx
import pytest

from terraqura_analytics.schemas import LeaderboardMetric
from terraqura_analytics.services.analytics_service import (
    AnalyticsDataUnavailable,
    AnalyticsService,
)


@pytest.mark.asyncio
async def test_protocol_stats_maps_live_marketplace_stats() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/marketplace/stats"
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "totalCreditsMinted": 1250,
                    "totalCreditsRetired": 250,
                    "avgPriceUsd24h": 28.5,
                    "floorPriceUsd": 20.0,
                    "totalVolumeUsd24h": 12000,
                    "activeListings": 7,
                },
            },
        )

    service = AnalyticsService(
        "https://api.example.test",
        transport=httpx.MockTransport(handler),
    )

    stats = await service.get_protocol_stats()

    assert stats.total_supply == 1250
    assert stats.total_retired == 250
    assert stats.total_verified == 1250
    assert stats.average_price == 28.5
    assert stats.total_volume_24h == 12000
    assert stats.active_projects == 7


@pytest.mark.asyncio
async def test_protocol_stats_fails_closed_when_live_source_is_unavailable() -> None:
    service = AnalyticsService(
        "https://api.example.test",
        transport=httpx.MockTransport(lambda _request: httpx.Response(503)),
    )

    with pytest.raises(AnalyticsDataUnavailable):
        await service.get_protocol_stats()


@pytest.mark.asyncio
async def test_traded_leaderboard_aggregates_live_purchase_history() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/marketplace/purchases"
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": [
                    {"buyerWallet": "0xaaa", "buyerId": "buyer-a", "amount": 10},
                    {"buyerWallet": "0xbbb", "buyerId": "buyer-b", "amount": 25},
                    {"buyerWallet": "0xaaa", "buyerId": "buyer-a", "amount": 5},
                ],
            },
        )

    service = AnalyticsService(
        "https://api.example.test",
        transport=httpx.MockTransport(handler),
    )

    leaderboard = await service.get_leaderboard(
        metric=LeaderboardMetric.TRADED,
        limit=2,
    )

    assert [entry.address for entry in leaderboard] == ["0xbbb", "0xaaa"]
    assert [entry.value for entry in leaderboard] == [25, 15]
    assert [entry.rank for entry in leaderboard] == [1, 2]


@pytest.mark.asyncio
async def test_synthetic_protocol_stats_require_explicit_opt_in() -> None:
    service = AnalyticsService(
        "https://api.example.test",
        allow_synthetic_data=True,
        transport=httpx.MockTransport(lambda _request: httpx.Response(500)),
    )

    stats = await service.get_protocol_stats()

    assert stats.total_supply == 1_250_000
    assert stats.active_projects == 147
