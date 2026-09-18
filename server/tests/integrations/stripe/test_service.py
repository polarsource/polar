import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import FX_QUOTES_API_VERSION
from polar.integrations.stripe.service import stripe as stripe_service


@pytest.mark.asyncio
class TestGetUsdBaseRates:
    async def test_valid(self, mocker: MockerFixture) -> None:
        fetch = mocker.patch(
            "polar.integrations.stripe.service.stripe_risk_client.raw_request_async",
            new_callable=AsyncMock,
            return_value=MagicMock(
                body=json.dumps(
                    {
                        "rates": {
                            "eur": {
                                "exchange_rate": 1.12443,
                                "rate_details": {"base_rate": 1.14738},
                            }
                        }
                    }
                )
            ),
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
