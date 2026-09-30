import json
from typing import Literal
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import FX_QUOTES_API_VERSION
from polar.integrations.stripe.service import stripe as stripe_service


@pytest.mark.asyncio
class TestCreateSetupIntent:
    async def test_excludes_sepa_payment_methods(self, mocker: MockerFixture) -> None:
        create = mocker.patch("stripe.SetupIntent.create_async")

        await stripe_service.create_setup_intent(
            automatic_payment_methods={"enabled": True},
            confirmation_token="ctoken_test",
            confirm=True,
            excluded_payment_method_types=["klarna"],
        )

        create.assert_awaited_once_with(
            automatic_payment_methods={"enabled": True},
            confirmation_token="ctoken_test",
            confirm=True,
            excluded_payment_method_types=[
                "klarna",
                "bancontact",
                "ideal",
                "sepa_debit",
                "sofort",
            ],
        )


@pytest.mark.asyncio
class TestCreatePaymentIntent:
    @pytest.mark.parametrize("setup_future_usage", [None, "off_session"])
    async def test_excludes_sepa_only_when_saving_for_recurring_payments(
        self,
        mocker: MockerFixture,
        setup_future_usage: Literal["off_session"] | None,
    ) -> None:
        create = mocker.patch("stripe.PaymentIntent.create_async")

        if setup_future_usage is None:
            await stripe_service.create_payment_intent(
                amount=1000, currency="eur", automatic_payment_methods={"enabled": True}
            )
        else:
            await stripe_service.create_payment_intent(
                amount=1000,
                currency="eur",
                automatic_payment_methods={"enabled": True},
                setup_future_usage=setup_future_usage,
            )

        create.assert_awaited_once()
        if setup_future_usage is None:
            assert "excluded_payment_method_types" not in create.call_args.kwargs
        else:
            assert create.call_args.kwargs["excluded_payment_method_types"] == [
                "bancontact",
                "ideal",
                "sepa_debit",
                "sofort",
            ]


@pytest.mark.asyncio
class TestGetUsdBaseRates:
    async def test_valid(self, mocker: MockerFixture) -> None:
        fetch = mocker.patch(
            "polar.integrations.stripe.service.stripe_risk_client.raw_request_async",
            new_callable=AsyncMock,
            return_value=MagicMock(
                body=json.dumps(
                    {"rates": {"eur": {"rate_details": {"base_rate": 1.14738}}}}
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
