from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import contains_eager, joinedload

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
from polar.models import Dispute, Payment, UserOrganization
from polar.models.dispute import DisputeAlertProcessor

from .sorting import DisputeSortProperty


class DisputeRepository(
    RepositorySortingMixin[Dispute, DisputeSortProperty],
    RepositorySoftDeletionIDMixin[Dispute, UUID],
    RepositorySoftDeletionMixin[Dispute],
    RepositoryBase[Dispute],
):
    model = Dispute

    async def get_by_payment_processor_dispute_id(
        self, processor: PaymentProcessor, processor_id: str, *, options: Options = ()
    ) -> Dispute | None:
        statement = (
            self.get_base_statement()
            .where(
                Dispute.payment_processor == processor,
                Dispute.payment_processor_id == processor_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_matching_by_dispute_alert(
        self,
        processor: PaymentProcessor,
        processor_payment_id: str,
        total_amount: int,
        currency: str,
        *,
        options: Options = (),
    ) -> Dispute | None:
        statement = (
            self.get_base_statement()
            .join(Dispute.payment)
            .where(
                Dispute.amount + Dispute.tax_amount == total_amount,
                Dispute.currency == currency,
                Payment.processor == processor,
                Payment.processor_id == processor_payment_id,
            )
            .options(*options)
            .order_by(Dispute.created_at.asc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def get_by_alert_processor_id(
        self,
        processor: DisputeAlertProcessor,
        processor_id: str,
        *,
        options: Options = (),
    ) -> Dispute | None:
        statement = (
            self.get_base_statement()
            .where(
                Dispute.dispute_alert_processor == processor,
                Dispute.dispute_alert_processor_id == processor_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Dispute]]:
        statement = (
            self.get_base_statement()
            .join(Dispute.payment)
            .options(contains_eager(Dispute.payment))
        )

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
                Payment.organization_id == auth_subject.subject.id
            )

        return statement

    def get_eager_options(self) -> Options:
        return (
            joinedload(Dispute.payment),
            joinedload(Dispute.order),
        )

    def get_sorting_clause(self, property: DisputeSortProperty) -> SortingClause:
        match property:
            case DisputeSortProperty.created_at:
                return Dispute.created_at
            case DisputeSortProperty.amount:
                return Dispute.amount
