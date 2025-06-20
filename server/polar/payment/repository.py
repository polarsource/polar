from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.enums import PaymentProcessor
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Payment, UserOrganization

from .sorting import PaymentSortProperty


class PaymentRepository(
    RepositorySortingMixin[Payment, PaymentSortProperty],
    RepositorySoftDeletionIDMixin[Payment, UUID],
    RepositorySoftDeletionMixin[Payment],
    RepositoryBase[Payment],
):
    model = Payment

    async def get_by_processor_id(
        self, processor: PaymentProcessor, processor_id: str
    ) -> Payment | None:
        statement = self.get_base_statement().where(
            Payment.processor == processor, Payment.processor_id == processor_id
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
