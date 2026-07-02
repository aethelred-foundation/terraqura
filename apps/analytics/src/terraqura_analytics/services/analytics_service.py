"""Main analytics orchestration service."""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from terraqura_analytics.schemas import (
    Interval,
    LeaderboardEntry,
    LeaderboardMetric,
    PricePoint,
    ProtocolStats,
)


class AnalyticsDataUnavailable(RuntimeError):
    """Raised when production analytics data cannot be resolved."""


class AnalyticsService:
    """Provides protocol-level statistics, leaderboards, and time-series data.

    Production mode reads from TerraQura API/indexer endpoints and fails closed
    when the source is unavailable. Synthetic data is available only when
    explicitly enabled for local drills, tests, and front-end development.
    """

    def __init__(
        self,
        api_url: str = "http://localhost:3001",
        *,
        allow_synthetic_data: bool = False,
        timeout_seconds: float = 2.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_url = api_url.rstrip("/")
        self._allow_synthetic_data = allow_synthetic_data
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def get_protocol_stats(self) -> ProtocolStats:
        """Return current protocol-wide aggregate statistics."""
        if self._allow_synthetic_data:
            return self._synthetic_protocol_stats()

        payload = await self._get_json("/v1/marketplace/stats")
        stats = self._unwrap_data(payload, "marketplace stats")

        return ProtocolStats(
            total_supply=self._float_value(stats, "totalCreditsMinted"),
            total_retired=self._float_value(stats, "totalCreditsRetired"),
            total_verified=self._float_value(stats, "totalCreditsMinted"),
            average_price=self._first_positive_float(
                stats,
                ["avgPriceUsd24h", "floorPriceUsd"],
            ),
            total_volume_24h=self._float_value(stats, "totalVolumeUsd24h"),
            active_projects=self._int_value(stats, "activeListings"),
            timestamp=datetime.now(timezone.utc),
        )

    async def get_price_history(
        self,
        interval: Interval = Interval.DAILY,
        periods: int = 30,
    ) -> list[PricePoint]:
        """Return OHLCV price history for carbon credits.

        Price history remains an explicit synthetic/local-drill view until the
        indexer exposes durable OHLCV candles. Production callers should not use
        this endpoint as settlement-grade market evidence.
        """
        if not self._allow_synthetic_data:
            raise AnalyticsDataUnavailable(
                "Price history requires indexed OHLCV candles; set TQ_ALLOW_SYNTHETIC_DATA=true only for local drills"
            )

        if periods < 1:
            raise ValueError("periods must be at least 1")

        delta_map = {
            Interval.DAILY: timedelta(days=1),
            Interval.WEEKLY: timedelta(weeks=1),
            Interval.MONTHLY: timedelta(days=30),
        }
        delta = delta_map[interval]
        now = datetime.now(timezone.utc)
        rng = random.Random(42)  # deterministic local-drill seed

        base_price = 22.0
        points: list[PricePoint] = []

        for i in range(periods):
            ts = now - delta * (periods - i)
            drift = 0.1 * math.sin(i / 5)
            noise = rng.gauss(0, 0.5)
            close = round(base_price + drift + noise, 4)
            high = round(close + abs(rng.gauss(0, 0.3)), 4)
            low = round(close - abs(rng.gauss(0, 0.3)), 4)
            open_ = round((close + rng.gauss(0, 0.2)), 4)
            volume = round(max(0, 1000 + rng.gauss(0, 200)), 2)
            base_price = close

            points.append(
                PricePoint(
                    timestamp=ts,
                    open=open_,
                    high=high,
                    low=low,
                    close=close,
                    volume=volume,
                )
            )

        return points

    async def get_leaderboard(
        self,
        metric: LeaderboardMetric = LeaderboardMetric.RETIRED,
        limit: int = 10,
    ) -> list[LeaderboardEntry]:
        """Return a ranked leaderboard for the given metric."""
        if limit < 1:
            raise ValueError("limit must be at least 1")

        if self._allow_synthetic_data:
            return self._synthetic_leaderboard(metric=metric, limit=limit)

        if metric is not LeaderboardMetric.TRADED:
            return []

        payload = await self._get_json(f"/v1/marketplace/purchases?limit={min(limit * 10, 100)}")
        purchases = self._unwrap_data(payload, "marketplace purchases")
        if not isinstance(purchases, list):
            raise AnalyticsDataUnavailable("Marketplace purchases response is not a list")

        totals: dict[str, float] = {}
        labels: dict[str, str] = {}
        for purchase in purchases:
            if not isinstance(purchase, dict):
                continue
            buyer = str(purchase.get("buyerWallet") or purchase.get("buyerId") or "")
            if not buyer:
                continue
            amount = self._coerce_float(purchase.get("amount"), default=0)
            totals[buyer] = totals.get(buyer, 0) + amount
            labels[buyer] = str(purchase.get("buyerId") or buyer)

        ranked = sorted(totals.items(), key=lambda item: item[1], reverse=True)
        return [
            LeaderboardEntry(
                rank=index + 1,
                address=address,
                value=round(value, 6),
                label=labels[address],
            )
            for index, (address, value) in enumerate(ranked[:limit])
        ]

    async def _get_json(self, path: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(
                base_url=self._api_url,
                timeout=self._timeout_seconds,
                transport=self._transport,
            ) as client:
                response = await client.get(path)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise AnalyticsDataUnavailable(
                f"Unable to fetch analytics source {path}: {exc}"
            ) from exc

        if not isinstance(payload, dict):
            raise AnalyticsDataUnavailable(f"Analytics source {path} did not return an object")
        return payload

    @staticmethod
    def _unwrap_data(payload: dict[str, Any], label: str) -> Any:
        if payload.get("success") is False:
            raise AnalyticsDataUnavailable(f"{label} source returned success=false")
        if "data" not in payload:
            raise AnalyticsDataUnavailable(f"{label} source missing data")
        return payload["data"]

    @staticmethod
    def _float_value(payload: dict[str, Any], field: str) -> float:
        return AnalyticsService._coerce_float(payload.get(field), default=0)

    @staticmethod
    def _first_positive_float(payload: dict[str, Any], fields: list[str]) -> float:
        for field in fields:
            value = AnalyticsService._float_value(payload, field)
            if value > 0:
                return value
        return 0

    @staticmethod
    def _int_value(payload: dict[str, Any], field: str) -> int:
        value = payload.get(field)
        if isinstance(value, bool):
            return 0
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str) and value.strip().isdigit():
            return int(value)
        return 0

    @staticmethod
    def _coerce_float(value: Any, *, default: float) -> float:
        if isinstance(value, bool):
            return default
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return default
        return default

    @staticmethod
    def _synthetic_protocol_stats() -> ProtocolStats:
        return ProtocolStats(
            total_supply=1_250_000.0,
            total_retired=320_000.0,
            total_verified=980_000.0,
            average_price=24.85,
            total_volume_24h=45_200.0,
            active_projects=147,
            timestamp=datetime.now(timezone.utc),
        )

    @staticmethod
    def _synthetic_leaderboard(
        metric: LeaderboardMetric,
        limit: int,
    ) -> list[LeaderboardEntry]:
        rng = random.Random(f"terraqura:{metric.value}:42")
        entries: list[LeaderboardEntry] = []

        for i in range(min(limit, 50)):
            addr = f"0x{rng.getrandbits(160):040x}"
            value = round(rng.uniform(100, 50_000) * (1 - i * 0.05), 2)
            entries.append(
                LeaderboardEntry(
                    rank=i + 1,
                    address=addr,
                    value=value,
                    label=f"Project #{i + 1}",
                )
            )

        return entries
