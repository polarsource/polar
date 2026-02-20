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
from polar.models import Benefit, UserOrganization
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

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Benefit]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Benefit.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Benefit.organization_id == auth_subject.subject.id,
            )

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
