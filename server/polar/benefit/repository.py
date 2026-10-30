from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload, undefer

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositoryExternalIDMixin,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Benefit
from polar.models.benefit import BenefitType
from polar.models.product_benefit import ProductBenefit

from .sorting import BenefitSortProperty


class BenefitRepository(
    RepositoryExternalIDMixin[Benefit],
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

    async def list_by_slack_integration_id(
        self,
        organization_id: UUID,
        slack_integration_id: UUID,
    ) -> Sequence[Benefit]:
        statement = self.get_base_statement().where(
            Benefit.organization_id == organization_id,
            Benefit.type == BenefitType.slack_shared_channel,
            Benefit.properties["slack_integration_id"].as_string()
            == str(slack_integration_id),
        )
        return await self.get_all(statement)

    async def get_all_by_external_ids(
        self,
        organization_id: UUID,
        external_ids: Sequence[str],
        *,
        for_update: bool = False,
    ) -> Sequence[Benefit]:
        statement = (
            self.get_base_statement()
            .where(
                Benefit.organization_id == organization_id,
                Benefit.external_id.in_(external_ids),
                Benefit.is_current,
            )
            .options(undefer(Benefit.external_id), *self.get_eager_options())
        )
        if for_update:
            statement = statement.with_for_update(of=Benefit, key_share=True)
        return await self.get_all(statement)

    def get_organization_statement(
        self, organization_id: UUID
    ) -> Select[tuple[Benefit]]:
        return (
            self.get_base_statement()
            .where(Benefit.organization_id == organization_id, Benefit.is_current)
            .order_by(Benefit.created_at, Benefit.id)
        )

    async def get_by_external_id_and_organization(
        self, external_id: str, organization_id: UUID
    ) -> Benefit | None:
        statement = self.get_base_statement().where(
            Benefit.external_id == external_id,
            Benefit.organization_id == organization_id,
            Benefit.is_current,
        )
        return await self.get_one_or_none(statement)

    async def get_external_ids_by_id(self, organization_id: UUID) -> dict[str, str]:
        """Map every benefit version's ID to its `external_id`."""
        statement = select(Benefit.id, Benefit.external_id).where(
            Benefit.organization_id == organization_id,
            Benefit.external_id.is_not(None),
            Benefit.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return {
            str(id): external_id
            for id, external_id in result.tuples()
            if external_id is not None
        }

    async def get_catalog_baseline(self, organization_id: UUID) -> Sequence[Benefit]:
        statement = (
            self.get_base_statement()
            .where(
                Benefit.organization_id == organization_id,
                Benefit.external_id.is_not(None),
                Benefit.is_current,
            )
            .options(undefer(Benefit.external_id))
        )
        return await self.get_all(statement)

    async def get_all_versions_by_ids(self, ids: Sequence[UUID]) -> Sequence[Benefit]:
        """Benefits by ID, including previous versions and deleted ones."""
        statement = (
            self.get_base_statement(include_deleted=True)
            .where(Benefit.id.in_(ids))
            .options(undefer(Benefit.external_id))
        )
        return await self.get_all(statement)

    async def list_by_organization_and_type(
        self, organization_id: UUID, benefit_type: BenefitType
    ) -> Sequence[Benefit]:
        statement = self.get_base_statement().where(
            Benefit.organization_id == organization_id,
            Benefit.type == benefit_type,
        )
        return await self.get_all(statement)

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
