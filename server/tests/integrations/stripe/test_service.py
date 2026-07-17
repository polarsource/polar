import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import stripe as stripe_service
from tests.fixtures.stripe import build_stripe_payment_intent


@pytest.mark.asyncio
class TestCancelPaymentIntent:
    async def test_calls_stripe_cancel(self, mocker: MockerFixture) -> None:
        canceled_intent = build_stripe_payment_intent(
            id="pi_test_cancel", status="canceled"
        )
        cancel_mock = mocker.patch(
            "polar.integrations.stripe.service.stripe_lib.PaymentIntent.cancel_async",
            return_value=canceled_intent,
        )

        result = await stripe_service.cancel_payment_intent("pi_test_cancel")

        cancel_mock.assert_awaited_once_with("pi_test_cancel")
        assert result is canceled_intent

    async def test_propagates_stripe_error(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "polar.integrations.stripe.service.stripe_lib.PaymentIntent.cancel_async",
            side_effect=stripe_lib.InvalidRequestError(
                "You cannot cancel this PaymentIntent because it has a status of "
                "succeeded.",
                param="intent",
                code="payment_intent_unexpected_state",
            ),
        )

        with pytest.raises(stripe_lib.InvalidRequestError):
            await stripe_service.cancel_payment_intent("pi_test_succeeded")
