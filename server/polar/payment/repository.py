from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.enums import PaymentProcessor
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Order, Payment, UserOrganization
from polar.models.payment import (
    DUNNING_COUNTING_TRIGGERS,
    PaymentStatus,
    PaymentTrigger,
)

from .sorting import PaymentSortProperty


class PaymentRepository(
    RepositorySortingMixin[Payment, PaymentSortProperty],
    RepositorySoftDeletionIDMixin[Payment, UUID],
    RepositorySoftDeletionMixin[Payment],
    RepositoryBase[Payment],
):
    model = Payment

    async def get_all_by_customer(
        self, customer_id: UUID, *, status: PaymentStatus | None = None
    ) -> Sequence[Payment]:
        statement = (
            self.get_base_statement()
            .join(Order, Payment.order_id == Order.id)
            .where(Order.is_deleted.is_(False), Order.customer_id == customer_id)
        )
        if status is not None:
            statement = statement.where(Payment.status == status)
        return await self.get_all(statement)

    async def get_succeeded_by_order(
        self, order_id: UUID, *, options: Options = ()
    ) -> Payment | None:
        statement = (
            self.get_base_statement()
            .where(
                Payment.order_id == order_id,
                Payment.status == PaymentStatus.succeeded,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_processor_id(
        self, processor: PaymentProcessor, processor_id: str, *, options: Options = ()
    ) -> Payment | None:
        statement = (
            self.get_base_statement()
            .where(Payment.processor == processor, Payment.processor_id == processor_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Payment]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Payment.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Payment.organization_id == auth_subject.subject.id,
            )

        return statement

    def get_sorting_clause(self, property: PaymentSortProperty) -> SortingClause:
        match property:
            case PaymentSortProperty.created_at:
                return Payment.created_at
            case PaymentSortProperty.status:
                return Payment.status
            case PaymentSortProperty.amount:
                return Payment.amount
            case PaymentSortProperty.method:
                return Payment.method

    async def count_failed_payments_for_order(self, order_id: UUID) -> int:
        """Count failed payments that count toward the dunning ceiling.

        See :data:`polar.models.payment.DUNNING_COUNTING_TRIGGERS` for the
        set of triggers included. Legacy rows with ``trigger IS NULL`` are
        excluded — the safer default for customers on historical data.
        """
        statement = select(func.count(Payment.id)).where(
            Payment.order_id == order_id,
            Payment.status == PaymentStatus.failed,
            Payment.trigger.in_(DUNNING_COUNTING_TRIGGERS),
        )
        result = await self.session.execute(statement)
        return result.scalar() or 0

    async def count_customer_retry_payments_for_order(self, order_id: UUID) -> int:
        """Count all payments triggered by manual customer retry for an order.

        Counts payments of *any* status (pending, failed, succeeded) with
        ``trigger = retry_customer`` to enforce a per-order ceiling on manual
        retry attempts — separate from the dunning ceiling.
        """
        statement = select(func.count(Payment.id)).where(
            Payment.order_id == order_id,
            Payment.trigger == PaymentTrigger.retry_customer,
        )
        result = await self.session.execute(statement)
        return result.scalar() or 0

    async def get_latest_for_order(self, order_id: UUID) -> Payment | None:
        """Get the latest payment for a specific order."""
        statement = (
            select(Payment)
            .where(Payment.order_id == order_id)
            .order_by(Payment.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def get_all_by_order(
        self, order_id: UUID, *, options: Options = ()
    ) -> Sequence[Payment]:
        """Get all payments for a specific order."""
        statement = (
            self.get_base_statement()
            .where(Payment.order_id == order_id)
            .order_by(Payment.created_at.desc())
            .options(*options)
        )
        return await self.get_all(statement)
