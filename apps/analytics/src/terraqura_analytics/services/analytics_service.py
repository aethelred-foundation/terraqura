"""Main analytics orchestration service."""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone

from terraqura_analytics.schemas import (
    Interval,
    LeaderboardEntry,
    LeaderboardMetric,
    PricePoint,
    ProtocolStats,
)


class AnalyticsService:
    """Provides protocol-level statistics, leaderboards, and time-series data.

    In production this service would fetch live data from the Aethelred RPC
    and the TerraQura API.  For now it returns deterministic demo data
    suitable for integration testing and front-end development.
    """

    def __init__(self, api_url: str = "http://localhost:3001") -> None:
        self._api_url = api_url

    async def get_protocol_stats(self) -> ProtocolStats:
        """Return current protocol-wide aggregate statistics.

        In production this would query the TerraQura subgraph / indexer.
        """
        return ProtocolStats(
            total_supply=1_250_000.0,
            total_retired=320_000.0,
            total_verified=980_000.0,
            average_price=24.85,
            total_volume_24h=45_200.0,
            active_projects=147,
            timestamp=datetime.now(timezone.utc),
        )

    async def get_price_history(
        self,
        interval: Interval = Interval.DAILY,
        periods: int = 30,
    ) -> list[PricePoint]:
        """Return OHLCV price history for carbon credits.

        Args:
            interval: Aggregation interval (daily, weekly, monthly).
            periods: Number of periods to return.

        Returns:
            Chronologically ordered list of price candles.
        """
        if periods < 1:
            raise ValueError("periods must be at least 1")

        delta_map = {
            Interval.DAILY: timedelta(days=1),
            Interval.WEEKLY: timedelta(weeks=1),
            Interval.MONTHLY: timedelta(days=30),
        }
        delta = delta_map[interval]
        now = datetime.now(timezone.utc)
        rng = random.Random(42)  # deterministic seed

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
        """Return a ranked leaderboard for the given metric.

        Args:
            metric: The metric to rank by.
            limit: Maximum number of entries to return.

        Returns:
            Leaderboard entries sorted by value descending.
        """
        if limit < 1:
            raise ValueError("limit must be at least 1")

        rng = random.Random(hash(metric.value) + 42)  # deterministic per metric
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
