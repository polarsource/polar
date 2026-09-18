import json
from unittest.mock import AsyncMock, MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import FX_QUOTES_API_VERSION
from polar.integrations.stripe.service import stripe as stripe_service


def _quote_body(
    *,
    base_rate: float | None = 1.14738,
    exchange_rate: float | None = 1.12443,
) -> str:
    quote: dict[str, object] = {}
    if exchange_rate is not None:
        quote["exchange_rate"] = exchange_rate
    if base_rate is not None:
        quote["rate_details"] = {"base_rate": base_rate}
    return json.dumps({"rates": {"eur": quote}})


@pytest.mark.asyncio
class TestGetUsdBaseRates:
    async def test_prefers_base_rate_over_fee_inclusive_exchange_rate(
        self, mocker: MockerFixture
    ) -> None:
        response = MagicMock(body=_quote_body())
        fetch = mocker.patch(
            "polar.integrations.stripe.service.stripe_risk_client.raw_request_async",
            new_callable=AsyncMock,
            return_value=response,
        )

        rates = await stripe_service.get_usd_base_rates(["EUR"])

        assert rates == {"eur": 1.14738}
        fetch.assert_awaited_once_with(
            "post",
            "/v1/fx_quotes",
            to_currency="usd",
            from_currencies=["eur"],
            lock_duration="none",
            stripe_version=FX_QUOTES_API_VERSION,
        )

    async def test_falls_back_to_exchange_rate_without_details(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch(
            "polar.integrations.stripe.service.stripe_risk_client.raw_request_async",
            new_callable=AsyncMock,
            return_value=MagicMock(body=_quote_body(base_rate=None)),
        )

        rates = await stripe_service.get_usd_base_rates(["eur"])

        assert rates == {"eur": 1.12443}

    async def test_stripe_errors_return_empty(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "polar.integrations.stripe.service.stripe_risk_client.raw_request_async",
            new_callable=AsyncMock,
            side_effect=stripe_lib.StripeError("unavailable"),
        )

        assert await stripe_service.get_usd_base_rates(["eur"]) == {}

    async def test_usd_is_skipped(self) -> None:
        assert await stripe_service.get_usd_base_rates(["usd"]) == {}
