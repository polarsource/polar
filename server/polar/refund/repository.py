from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Refund, UserOrganization

from .sorting import RefundSortProperty


class RefundRepository(
    RepositorySortingMixin[Refund, RefundSortProperty],
    RepositorySoftDeletionIDMixin[Refund, UUID],
    RepositorySoftDeletionMixin[Refund],
    RepositoryBase[Refund],
):
    model = Refund

    async def get_by_processor_id(
        self, processor_id: str, *, options: Options = ()
    ) -> Refund | None:
        statement = (
            self.get_base_statement()
            .where(Refund.processor_id == processor_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Refund]]:
        statement = self.get_base_statement().where(
            Refund.order_id.is_not(None),
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Refund.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Refund.organization_id == auth_subject.subject.id,
            )

        return statement

    def get_eager_options(self, *, order_options: Options = ()) -> Options:
        return (
            joinedload(Refund.organization),
            joinedload(Refund.dispute),
            joinedload(Refund.order).options(
                *order_options,  # type: ignore
            ),
        )

    def get_sorting_clause(self, property: RefundSortProperty) -> SortingClause:
        match property:
            case RefundSortProperty.created_at:
                return Refund.created_at
            case RefundSortProperty.amount:
                return Refund.amount
