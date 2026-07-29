from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, String, and_, cast, or_, select, update
from sqlalchemy.orm import joinedload

from polar.enums import PaymentProcessor
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Customer, PaymentMethod, Subscription
from polar.models.email_log import EmailLog, EmailLogStatus


def _expiration_datetime(year: int, month: int) -> datetime:
    """Cards stay valid through the end of their expiration month."""
    return datetime(year + month // 12, month % 12 + 1, 1, tzinfo=UTC)


def expiring_periods(now: datetime, window_end: datetime) -> list[tuple[int, int]]:
    """(year, month) pairs whose expiration falls within (now, window_end]."""
    periods: list[tuple[int, int]] = []
    year, month = now.year, now.month
    while _expiration_datetime(year, month) <= window_end:
        periods.append((year, month))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return periods


class PaymentMethodRepository(
    RepositorySoftDeletionIDMixin[PaymentMethod, UUID],
    RepositorySoftDeletionMixin[PaymentMethod],
    RepositoryBase[PaymentMethod],
):
    model = PaymentMethod

    async def get_by_id_and_customer(
        self,
        id: UUID,
        customer: UUID,
        *,
        options: Options = (),
    ) -> PaymentMethod | None:
        statement = (
            self.get_base_statement()
            .where(
                PaymentMethod.id == id,
                PaymentMethod.customer_id == customer,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_customer_and_processor_id(
        self,
        customer: UUID,
        processor: PaymentProcessor,
        processor_id: str,
        *,
        options: Options = (),
        include_deleted: bool = False,
    ) -> PaymentMethod | None:
        statement = (
            self.get_base_statement(include_deleted=include_deleted)
            .where(
                PaymentMethod.customer_id == customer,
                PaymentMethod.processor == processor,
                PaymentMethod.processor_id == processor_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_by_customer_statement(
        self, customer_id: UUID
    ) -> Select[tuple[PaymentMethod]]:
        return self.get_base_statement().where(PaymentMethod.customer_id == customer_id)

    async def get_by_processor_id(
        self,
        processor: PaymentProcessor,
        processor_id: str,
        *,
        options: Options = (),
    ) -> PaymentMethod | None:
        statement = (
            self.get_base_statement()
            .where(
                PaymentMethod.processor == processor,
                PaymentMethod.processor_id == processor_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def list_by_customer(
        self,
        customer_id: UUID,
        *,
        exclude_id: UUID | None = None,
        options: Options = (),
    ) -> list[PaymentMethod]:
        statement = self.get_base_statement().where(
            PaymentMethod.customer_id == customer_id
        )
        if exclude_id is not None:
            statement = statement.where(PaymentMethod.id != exclude_id)
        statement = statement.options(*options)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_cards_needing_expiration_reminder(
        self,
        now: datetime,
        window_end: datetime,
        *,
        options: Options = (),
    ) -> Sequence[PaymentMethod]:
        """
        Find card payment methods expiring within the window that back a billable
        subscription and have no sent `payment_method_expiration_reminder` email logged for
        that expiration.
        """
        periods = expiring_periods(now, window_end)
        if not periods:
            return []

        exp_year = PaymentMethod.method_metadata["exp_year"].as_integer()
        exp_month = PaymentMethod.method_metadata["exp_month"].as_integer()
        expiring_condition = or_(
            *(and_(exp_year == year, exp_month == month) for year, month in periods)
        )

        billable_subscription_subquery = (
            select(Subscription.id)
            .where(
                Subscription.payment_method_id == PaymentMethod.id,
                Subscription.billable.is_(True),
                Subscription.deleted_at.is_(None),
            )
            .correlate(PaymentMethod)
            .exists()
        )

        logged_payment_method = EmailLog.email_props["payment_method"]
        already_sent_subquery = (
            select(EmailLog.id)
            .where(
                EmailLog.email_template == "payment_method_expiration_reminder",
                EmailLog.status == EmailLogStatus.sent,
                logged_payment_method["id"].as_string()
                == cast(PaymentMethod.id, String),
                logged_payment_method["method_metadata"]["exp_year"].as_integer()
                == exp_year,
                logged_payment_method["method_metadata"]["exp_month"].as_integer()
                == exp_month,
            )
            .correlate(PaymentMethod)
            .exists()
        )

        statement = (
            self.get_base_statement()
            .where(
                PaymentMethod.type == "card",
                expiring_condition,
                billable_subscription_subquery,
                ~already_sent_subquery,
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def soft_delete(
        self, object: PaymentMethod, *, flush: bool = False
    ) -> PaymentMethod:
        # Unlink the payment method from the customer and subscriptions
        await self.session.execute(
            update(Customer)
            .values(default_payment_method_id=None)
            .where(Customer.default_payment_method_id == object.id)
        )
        await self.session.execute(
            update(Subscription)
            .values(payment_method_id=None)
            .where(Subscription.payment_method_id == object.id)
        )

        return await super().soft_delete(object, flush=flush)

    def get_eager_options(self) -> Options:
        return (joinedload(PaymentMethod.customer),)
