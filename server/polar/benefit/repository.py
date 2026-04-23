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
from polar.models import Benefit
from polar.models.product_benefit import ProductBenefit

from .sorting import BenefitSortProperty


class BenefitRepository(
    RepositorySortingMixin[Benefit, BenefitSortProperty],
    RepositorySoftDeletionIDMixin[Benefit, UUID],
    RepositorySoftDeletionMixin[Benefit],
    RepositoryBase[Benefit],
):
    model = Benefit

    async def get_by_id_and_product(
        self,
        id: UUID,
        product_id: UUID,
        *,
        options: Options = (),
    ) -> Benefit | None:
        statement = (
            self.get_base_statement()
            .join(ProductBenefit, onclause=ProductBenefit.benefit_id == Benefit.id)
            .where(Benefit.id == id, ProductBenefit.product_id == product_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> Options:
        return (joinedload(Benefit.organization),)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Benefit]]:
        statement = self.get_base_statement()
        statement = statement.where(Benefit.organization_id.in_(org_ids))
        return statement

    def get_sorting_clause(self, property: BenefitSortProperty) -> SortingClause:
        match property:
            case BenefitSortProperty.created_at:
                return Benefit.created_at
            case BenefitSortProperty.description:
                return Benefit.description
            case BenefitSortProperty.type:
                return Benefit.type
            case BenefitSortProperty.user_order:
                return Benefit.created_at
