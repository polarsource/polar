import json
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.email.react import serialize_email_props
from polar.enums import EmailSender
from polar.kit.utils import utc_now
from polar.models import Customer, PaymentMethod, Product, Subscription
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.models.subscription import SubscriptionStatus
from polar.payment_method.repository import (
    PaymentMethodRepository,
    expiring_periods,
)
from polar.payment_method.service import (
    payment_method as payment_method_service,
)
from polar.payment_method.tasks import EXPIRATION_REMINDER_WINDOW
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_payment_method,
    create_subscription,
)

NOW = datetime(2026, 4, 10, tzinfo=UTC)
WINDOW_END = NOW + timedelta(days=30)


class TestExpiringPeriods:
    def test_includes_the_current_month(self) -> None:
        assert expiring_periods(NOW, WINDOW_END) == [(2026, 4)]

    def test_excludes_months_expiring_after_the_window(self) -> None:
        assert expiring_periods(NOW, NOW + timedelta(days=5)) == []

    def test_rolls_over_to_the_next_year(self) -> None:
        now = datetime(2026, 12, 5, tzinfo=UTC)
        assert expiring_periods(now, now + timedelta(days=40)) == [(2026, 12)]

    def test_does_not_remind_at_the_start_of_the_month(self) -> None:
        start = datetime(2026, 4, 1, tzinfo=UTC)
        assert (2026, 4) not in expiring_periods(
            start, start + EXPIRATION_REMINDER_WINDOW
        )

    def test_reminds_well_before_the_card_expires(self) -> None:
        later = datetime(2026, 4, 16, tzinfo=UTC)
        assert (2026, 4) in expiring_periods(later, later + EXPIRATION_REMINDER_WINDOW)

    def test_spans_two_months(self) -> None:
        now = datetime(2026, 4, 1, tzinfo=UTC)
        assert expiring_periods(now, now + timedelta(days=62)) == [
            (2026, 4),
            (2026, 5),
        ]


async def create_expiring_card(
    save_fixture: SaveFixture,
    customer: Customer,
    product: Product,
    *,
    exp_month: int = 4,
    exp_year: int = 2026,
    type: str = "card",
    status: SubscriptionStatus = SubscriptionStatus.active,
) -> PaymentMethod:
    payment_method = await create_payment_method(
        save_fixture,
        customer,
        type=type,
        method_metadata={
            "brand": "visa",
            "last4": "4242",
            "exp_month": exp_month,
            "exp_year": exp_year,
        },
    )
    if status == SubscriptionStatus.active:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )
    else:
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
            status=status,
        )
    return payment_method


async def create_sent_log(
    save_fixture: SaveFixture,
    payment_method: PaymentMethod,
    *,
    exp_month: int = 4,
    exp_year: int = 2026,
    email_template: str = "payment_method_expiration_reminder",
) -> EmailLog:
    props: dict[str, Any] = {
        "payment_method": {
            "id": str(payment_method.id),
            "method_metadata": {"exp_month": exp_month, "exp_year": exp_year},
        }
    }
    email_log = EmailLog(
        status=EmailLogStatus.sent,
        processor=EmailSender.resend,
        to_email_addr="customer@example.com",
        from_email_addr="acme@polar.sh",
        from_name="Acme",
        subject="Your card ending in 4242 expires soon",
        email_template=email_template,
        email_props=props,
    )
    await save_fixture(email_log)
    return email_log


@pytest.mark.asyncio
class TestGetCardsExpiring:
    async def test_returns_card_expiring_in_window(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method = await create_expiring_card(save_fixture, customer, product)

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert [pm.id for pm in result] == [payment_method.id]

    async def test_excludes_card_expiring_after_window(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        await create_expiring_card(
            save_fixture, customer, product, exp_month=11, exp_year=2026
        )

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert result == []

    async def test_excludes_already_expired_card(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        await create_expiring_card(
            save_fixture, customer, product, exp_month=1, exp_year=2026
        )

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert result == []

    async def test_excludes_card_without_billable_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        await create_expiring_card(
            save_fixture, customer, product, status=SubscriptionStatus.canceled
        )

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert result == []

    async def test_excludes_card_whose_subscription_is_soft_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method = await create_expiring_card(save_fixture, customer, product)
        subscription = (
            (
                await session.execute(
                    select(Subscription).where(
                        Subscription.payment_method_id == payment_method.id
                    )
                )
            )
            .scalars()
            .one()
        )
        subscription.deleted_at = utc_now()
        await save_fixture(subscription)

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert result == []

    async def test_excludes_card_without_any_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        await create_payment_method(
            save_fixture,
            customer,
            method_metadata={
                "brand": "visa",
                "last4": "4242",
                "exp_month": 4,
                "exp_year": 2026,
            },
        )

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert result == []

    async def test_excludes_non_card_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        await create_expiring_card(save_fixture, customer, product, type="link")

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert result == []

    async def test_excludes_card_already_reminded(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method = await create_expiring_card(save_fixture, customer, product)
        await create_sent_log(save_fixture, payment_method)

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert result == []

    async def test_returns_card_reminded_for_a_previous_expiration(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method = await create_expiring_card(save_fixture, customer, product)
        await create_sent_log(save_fixture, payment_method, exp_month=4, exp_year=2025)

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert [pm.id for pm in result] == [payment_method.id]

    async def test_ignores_logs_for_other_templates(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        payment_method = await create_expiring_card(save_fixture, customer, product)
        await create_sent_log(
            save_fixture, payment_method, email_template="order_confirmation"
        )

        repository = PaymentMethodRepository.from_session(session)
        result = await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)

        assert [pm.id for pm in result] == [payment_method.id]


@pytest.mark.asyncio
class TestDedupRoundTrip:
    async def test_real_send_props_suppress_the_next_scan(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """The dedup query must read the props the sender actually writes."""
        payment_method = await create_expiring_card(save_fixture, customer, product)
        enqueue_mock = mocker.patch(
            "polar.payment_method.service.enqueue_email_template", autospec=True
        )

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )

        # Reproduce exactly what the `email.send` actor persists
        email = enqueue_mock.call_args.args[0]
        email_props = json.loads(serialize_email_props(email))
        email_log = EmailLog(
            status=EmailLogStatus.sent,
            processor=EmailSender.resend,
            to_email_addr=enqueue_mock.call_args.kwargs["to_email_addr"],
            from_email_addr="acme@polar.sh",
            from_name="Acme",
            subject=enqueue_mock.call_args.kwargs["subject"],
            email_template=email.template,
            email_props=email_props,
        )
        await save_fixture(email_log)

        repository = PaymentMethodRepository.from_session(session)
        assert (
            await repository.get_cards_needing_expiration_reminder(NOW, WINDOW_END)
            == []
        )
