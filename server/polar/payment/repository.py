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
from polar.models.payment import PaymentStatus

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
            .where(Order.deleted_at.is_(None), Order.customer_id == customer_id)
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
                        UserOrganization.deleted_at.is_(None),
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
        """Count the number of failed payments for a specific order."""
        statement = select(func.count(Payment.id)).where(
            Payment.order_id == order_id,
            Payment.status == PaymentStatus.failed,
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
