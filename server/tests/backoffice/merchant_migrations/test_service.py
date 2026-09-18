from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.backoffice.merchant_migrations.mrr import Money, MrrBreakdown
from polar.backoffice.merchant_migrations.service import (
    USD_RATE_CACHE_TTL_SECONDS,
)
from polar.backoffice.merchant_migrations.service import (
    merchant_migrations as merchant_migrations_service,
)
from polar.redis import Redis


@pytest.mark.asyncio
class TestUsdRates:
    async def test_valid(self, mocker: MockerFixture, redis: Redis) -> None:
        fetch = mocker.patch(
            "polar.backoffice.merchant_migrations.service.stripe_service.get_usd_base_rates",
            new_callable=AsyncMock,
            return_value={"eur": 1.14738},
        )
        breakdowns = [MrrBreakdown(Money({"eur": 11100}), Money(), Money())]

        rates = await merchant_migrations_service.usd_rates(redis, breakdowns)
        cached = await merchant_migrations_service.usd_rates(redis, breakdowns)

        assert rates == {"eur": 1.14738}
        assert cached == rates
        fetch.assert_awaited_once_with(["eur"])
        ttl = await redis.ttl("polar:fx:usd:v1:eur")
        assert 0 < ttl <= USD_RATE_CACHE_TTL_SECONDS

    async def test_invalid_cache_is_a_miss(
        self, mocker: MockerFixture, redis: Redis
    ) -> None:
        fetch = mocker.patch(
            "polar.backoffice.merchant_migrations.service.stripe_service.get_usd_base_rates",
            new_callable=AsyncMock,
            return_value={"eur": 1.14738},
        )
        await redis.set("polar:fx:usd:v1:eur", "not-a-rate")
        breakdowns = [MrrBreakdown(Money({"eur": 11100}), Money(), Money())]

        rates = await merchant_migrations_service.usd_rates(redis, breakdowns)

        assert rates == {"eur": 1.14738}
        fetch.assert_awaited_once_with(["eur"])

    async def test_usd_only_skips_stripe(
        self, mocker: MockerFixture, redis: Redis
    ) -> None:
        fetch = mocker.patch(
            "polar.backoffice.merchant_migrations.service.stripe_service.get_usd_base_rates",
            new_callable=AsyncMock,
        )
        breakdowns = [MrrBreakdown(Money({"usd": 16350}), Money(), Money())]

        rates = await merchant_migrations_service.usd_rates(redis, breakdowns)

        assert rates == {}
        fetch.assert_not_called()
