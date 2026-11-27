from datetime import timedelta
from typing import Any
from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.payment_retry_alert.service import (
    STRIPE_METADATA_PAYMENT_RETRY_ALERT_ID,
    DeclinedPaymentNotFound,
    MissingNetworkTransactionId,
    SkipReason,
)
from polar.integrations.payment_retry_alert.service import (
    payment_retry_alert as payment_retry_alert_service,
)
from polar.integrations.payment_retry_alert.types import (
    PaymentRetryAlert,
    RetryOutcome,
)
from polar.integrations.stripe.service import StripeService
from polar.kit.utils import utc_now
from polar.models import Customer, Order, Organization, Payment, Product
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus, PaymentTrigger
from polar.models.subscription import SubscriptionStatus
from polar.order.service import PaymentFailed, PaymentFailedReason
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_payment,
    create_payment_method,
    create_subscription,
)

BANKNET_REFERENCE = "ABC123456"
DECLINED_CARD: dict[str, Any] = {
    "brand": "mastercard",
    "last4": "1234",
    "fingerprint": "CARD_FINGERPRINT",
    "network_transaction_id": f"MCC{BANKNET_REFERENCE}1118",
}


def build_alert(network_transaction_id: str = BANKNET_REFERENCE) -> PaymentRetryAlert:
    return {
        "id": "alrt_test",
        "notification_type": "RETRY_NOW",
        "network_transaction_id": network_transaction_id,
    }


@pytest.fixture
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.order.service.stripe_service", new=mock)
    return mock


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.integrations.payment_retry_alert.service.enqueue_job")


@pytest.fixture
def log_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.integrations.payment_retry_alert.service.log")


@pytest.fixture
async def dunning_order(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> Order:
    payment_method = await create_payment_method(
        save_fixture, customer, method_metadata={"fingerprint": "CARD_FINGERPRINT"}
    )
    subscription = await create_subscription(
        save_fixture,
        product=product,
        customer=customer,
        payment_method=payment_method,
        status=SubscriptionStatus.past_due,
        past_due_at=utc_now() - timedelta(days=1),
    )
    return await create_order(
        save_fixture,
        product=product,
        customer=customer,
        subscription=subscription,
        status=OrderStatus.pending,
        next_payment_attempt_at=utc_now() + timedelta(days=1),
    )


@pytest.fixture
async def declined_payment(
    save_fixture: SaveFixture, organization: Organization, dunning_order: Order
) -> Payment:
    return await create_payment(
        save_fixture,
        organization,
        status=PaymentStatus.failed,
        amount=2150,
        method_metadata=DECLINED_CARD,
        decline_reason="insufficient_funds",
        trigger=PaymentTrigger.subscription_cycle,
        order=dunning_order,
    )


@pytest.mark.anyio
class TestHandleAlert:
    @pytest.mark.parametrize(
        "network_transaction_id",
        [
            pytest.param(BANKNET_REFERENCE, id="banknet_reference"),
            pytest.param(DECLINED_CARD["network_transaction_id"], id="trace_id"),
        ],
    )
    async def test_retry(
        self,
        network_transaction_id: str,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        dunning_order: Order,
        declined_payment: Payment,
    ) -> None:
        await payment_retry_alert_service.handle_alert(
            session, build_alert(network_transaction_id)
        )

        params = stripe_service_mock.create_payment_intent.call_args.kwargs
        assert params["idempotency_key"] == "payment_retry_alert:alrt_test"
        assert params["metadata"]["order_id"] == str(dunning_order.id)
        assert params["metadata"]["payment_trigger"] == "retry_payment_alert"
        assert params["metadata"][STRIPE_METADATA_PAYMENT_RETRY_ALERT_ID] == "alrt_test"

    @pytest.mark.parametrize(
        ("network_transaction_id", "error"),
        [
            pytest.param("", MissingNetworkTransactionId, id="missing"),
            pytest.param("UNKNOWN", DeclinedPaymentNotFound, id="unknown"),
        ],
    )
    async def test_unmatched(
        self,
        network_transaction_id: str,
        error: type[Exception],
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        declined_payment: Payment,
    ) -> None:
        with pytest.raises(error):
            await payment_retry_alert_service.handle_alert(
                session, build_alert(network_transaction_id)
            )

        stripe_service_mock.create_payment_intent.assert_not_called()

    async def test_order_not_in_dunning(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        log_mock: MagicMock,
        dunning_order: Order,
        declined_payment: Payment,
    ) -> None:
        dunning_order.status = OrderStatus.paid
        dunning_order.next_payment_attempt_at = None
        await save_fixture(dunning_order)

        await payment_retry_alert_service.handle_alert(session, build_alert())

        stripe_service_mock.create_payment_intent.assert_not_called()
        assert log_mock.info.call_args.kwargs["reason"] == SkipReason.not_in_dunning

    async def test_max_attempts_reached(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        log_mock: MagicMock,
        organization: Organization,
        dunning_order: Order,
        declined_payment: Payment,
    ) -> None:
        for _ in range(3):
            await create_payment(
                save_fixture,
                organization,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.retry_payment_alert,
                order=dunning_order,
            )

        await payment_retry_alert_service.handle_alert(session, build_alert())

        stripe_service_mock.create_payment_intent.assert_not_called()
        assert log_mock.info.call_args.kwargs["reason"] == (
            SkipReason.max_attempts_reached
        )
        enqueue_job_mock.assert_called_once_with(
            "payment_retry_alert.report_outcome",
            alert_id="alrt_test",
            outcome=RetryOutcome.not_attempted,
        )

    @pytest.mark.parametrize(
        ("cause", "reported"),
        [
            pytest.param(
                stripe_lib.CardError("Declined", None, "card_declined"),
                False,
                id="declined",
            ),
            pytest.param(
                stripe_lib.InvalidRequestError("Detached", None), True, id="rejected"
            ),
        ],
    )
    async def test_failed_retry(
        self,
        cause: stripe_lib.StripeError,
        reported: bool,
        mocker: MockerFixture,
        session: AsyncSession,
        enqueue_job_mock: MagicMock,
        declined_payment: Payment,
    ) -> None:
        failure = PaymentFailed(PaymentFailedReason.card_error)
        failure.__cause__ = cause
        mocker.patch(
            "polar.integrations.payment_retry_alert.service.order_service.trigger_payment",
            side_effect=failure,
        )

        await payment_retry_alert_service.handle_alert(session, build_alert())

        if reported:
            enqueue_job_mock.assert_called_once_with(
                "payment_retry_alert.report_outcome",
                alert_id="alrt_test",
                outcome=RetryOutcome.failed,
            )
        else:
            enqueue_job_mock.assert_not_called()
