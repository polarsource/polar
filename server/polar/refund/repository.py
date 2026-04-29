from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select
from sqlalchemy.orm import joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Refund
from polar.models.refund import RefundStatus

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

    async def get_succeeded_by_order(self, order_id: UUID) -> Sequence[Refund]:
        statement = (
            self.get_base_statement()
            .where(
                Refund.order_id == order_id,
                Refund.status == RefundStatus.succeeded,
            )
            .order_by(Refund.created_at.asc())
        )
        return await self.get_all(statement)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Refund]]:
        statement = self.get_base_statement().where(
            Refund.order_id.is_not(None),
        )
        statement = statement.where(Refund.organization_id.in_(org_ids))
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
