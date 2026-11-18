from collections.abc import Callable
from datetime import timedelta
from typing import Any
from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.payment_retry_alert.service import (
    STRIPE_METADATA_PAYMENT_RETRY_ALERT_ID,
    SkipReason,
)
from polar.integrations.payment_retry_alert.service import (
    payment_retry_alert as payment_retry_alert_service,
)
from polar.integrations.payment_retry_alert.types import PaymentRetryAlert
from polar.integrations.stripe.service import StripeService
from polar.kit.utils import utc_now
from polar.models import Customer, Order, Organization, Payment, PaymentMethod, Product
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.payment import PaymentStatus, PaymentTrigger
from polar.models.subscription import SubscriptionStatus
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


def build_alert(
    *,
    notification_type: str = "RETRY_NOW",
    network_transaction_id: str = BANKNET_REFERENCE,
    card_last_four: str = "1234",
    transaction_time: str | None = None,
) -> PaymentRetryAlert:
    return {
        "id": "alrt_test",
        "enrolment_mid": "MID",
        "card_scheme": "MASTERCARD",
        "notification_type": notification_type,
        "transaction_time": transaction_time or utc_now().isoformat(),
        "transaction_amount_in_cents": 2150,
        "transaction_currency": "USD",
        "network_transaction_id": network_transaction_id,
        "card_last_four": card_last_four,
    }


@pytest.fixture
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.order.service.stripe_service", new=mock)
    return mock


@pytest.fixture
def assert_not_attempted(
    mocker: MockerFixture, stripe_service_mock: MagicMock
) -> Callable[[SkipReason], None]:
    log_mock = mocker.patch("polar.integrations.payment_retry_alert.service.log")

    def assert_reported(reason: SkipReason) -> None:
        stripe_service_mock.create_payment_intent.assert_not_called()
        log_mock.info.assert_called_once_with(
            "Payment retry alert not attempted", alert_id="alrt_test", reason=reason
        )

    return assert_reported


@pytest.fixture
async def card_payment_method(
    save_fixture: SaveFixture, customer: Customer
) -> PaymentMethod:
    return await create_payment_method(
        save_fixture, customer, method_metadata={"fingerprint": "CARD_FINGERPRINT"}
    )


async def create_dunning_order(
    save_fixture: SaveFixture,
    *,
    product: Product,
    customer: Customer,
    payment_method: PaymentMethod,
) -> Order:
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
        billing_reason=OrderBillingReasonInternal.subscription_cycle,
        next_payment_attempt_at=utc_now() + timedelta(days=1),
    )


@pytest.fixture
async def dunning_order(
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
    card_payment_method: PaymentMethod,
) -> Order:
    return await create_dunning_order(
        save_fixture,
        product=product,
        customer=customer,
        payment_method=card_payment_method,
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
    async def test_not_retry_now(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        declined_payment: Payment,
    ) -> None:
        await payment_retry_alert_service.handle_alert(
            session, build_alert(notification_type="OTHER")
        )

        stripe_service_mock.create_payment_intent.assert_not_called()

    @pytest.mark.parametrize(
        ("network_transaction_id", "card_last_four"),
        [
            pytest.param(BANKNET_REFERENCE, "", id="banknet_reference"),
            pytest.param(DECLINED_CARD["network_transaction_id"], "", id="trace_id"),
            pytest.param("", "1234", id="card_details"),
        ],
    )
    async def test_retry(
        self,
        network_transaction_id: str,
        card_last_four: str,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        dunning_order: Order,
        card_payment_method: PaymentMethod,
        declined_payment: Payment,
    ) -> None:
        await payment_retry_alert_service.handle_alert(
            session,
            build_alert(
                network_transaction_id=network_transaction_id,
                card_last_four=card_last_four,
            ),
        )

        stripe_service_mock.create_payment_intent.assert_called_once()
        params = stripe_service_mock.create_payment_intent.call_args.kwargs
        assert params["payment_method"] == card_payment_method.processor_id
        assert params["off_session"] is True
        assert params["idempotency_key"] == "payment_retry_alert:alrt_test"
        assert params["metadata"]["order_id"] == str(dunning_order.id)
        assert params["metadata"]["payment_trigger"] == (
            PaymentTrigger.retry_payment_alert
        )
        assert params["metadata"][STRIPE_METADATA_PAYMENT_RETRY_ALERT_ID] == (
            "alrt_test"
        )

    async def test_declined_retry(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        declined_payment: Payment,
    ) -> None:
        stripe_service_mock.create_payment_intent.side_effect = stripe_lib.CardError(
            "Your card has insufficient funds.", None, "card_declined"
        )

        await payment_retry_alert_service.handle_alert(session, build_alert())

        stripe_service_mock.create_payment_intent.assert_called_once()

    @pytest.mark.parametrize(
        "alert",
        [
            pytest.param(
                build_alert(network_transaction_id="", card_last_four="9999"),
                id="other_card",
            ),
            pytest.param(
                build_alert(
                    network_transaction_id="",
                    transaction_time=(utc_now() - timedelta(days=5)).isoformat(),
                ),
                id="far_from_decline_time",
            ),
        ],
    )
    async def test_unmatched(
        self,
        alert: PaymentRetryAlert,
        session: AsyncSession,
        assert_not_attempted: Callable[[SkipReason], None],
        declined_payment: Payment,
    ) -> None:
        await payment_retry_alert_service.handle_alert(session, alert)

        assert_not_attempted(SkipReason.unmatched)

    async def test_ambiguous_card_details(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        assert_not_attempted: Callable[[SkipReason], None],
        organization: Organization,
        product: Product,
        customer: Customer,
        card_payment_method: PaymentMethod,
        declined_payment: Payment,
    ) -> None:
        other_order = await create_dunning_order(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=card_payment_method,
        )
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            amount=2150,
            method_metadata={**DECLINED_CARD, "network_transaction_id": None},
            order=other_order,
        )

        await payment_retry_alert_service.handle_alert(
            session, build_alert(network_transaction_id="")
        )

        assert_not_attempted(SkipReason.unmatched)

    @pytest.mark.parametrize(
        ("order_update", "reason"),
        [
            pytest.param(
                {"status": OrderStatus.paid, "next_payment_attempt_at": None},
                SkipReason.unmatched,
                id="paid",
            ),
            pytest.param(
                {"payment_lock_acquired_at": utc_now()},
                SkipReason.payment_in_progress,
                id="payment_in_progress",
            ),
        ],
    )
    async def test_order_state(
        self,
        order_update: dict[str, Any],
        reason: SkipReason,
        save_fixture: SaveFixture,
        session: AsyncSession,
        assert_not_attempted: Callable[[SkipReason], None],
        dunning_order: Order,
        declined_payment: Payment,
    ) -> None:
        for key, value in order_update.items():
            setattr(dunning_order, key, value)
        await save_fixture(dunning_order)

        await payment_retry_alert_service.handle_alert(session, build_alert())

        assert_not_attempted(reason)

    async def test_max_attempts_reached(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        assert_not_attempted: Callable[[SkipReason], None],
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

        assert_not_attempted(SkipReason.max_attempts_reached)

    async def test_payment_method_changed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        assert_not_attempted: Callable[[SkipReason], None],
        customer: Customer,
        dunning_order: Order,
        declined_payment: Payment,
    ) -> None:
        assert dunning_order.subscription is not None
        dunning_order.subscription.payment_method = await create_payment_method(
            save_fixture, customer, method_metadata={"fingerprint": "NEW_FINGERPRINT"}
        )
        await save_fixture(dunning_order.subscription)

        await payment_retry_alert_service.handle_alert(session, build_alert())

        assert_not_attempted(SkipReason.payment_method_changed)
