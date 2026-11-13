from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, or_, select
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
from polar.models import Benefit, Catalog, CatalogBenefit
from polar.models.benefit import BenefitType
from polar.models.catalog import CatalogStatus
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

    async def get_for_manual_grant(
        self,
        organization_id: UUID,
        *,
        benefit_id: UUID | None = None,
        external_id: str | None = None,
    ) -> Benefit | None:
        statement = (
            self.get_base_statement()
            .where(
                Benefit.organization_id == organization_id,
                ~Benefit.catalog.has(Catalog.status == CatalogStatus.draft),
            )
            .options(*self.get_eager_options())
        )
        if benefit_id is not None:
            statement = statement.where(Benefit.id == benefit_id)
        else:
            statement = statement.where(
                Benefit.external_id == external_id, Benefit.is_current
            )
        return await self.get_one_or_none(statement)

    async def count_by_organization_id(self, organization_id: UUID) -> int:
        return await self.count(
            self.get_base_statement().where(Benefit.organization_id == organization_id)
        )

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

    async def get_retired_by_external_ids(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> Sequence[Benefit]:
        """The latest published version of each benefit that is no longer current."""
        if not external_ids:
            return []
        drafts = select(Catalog.id).where(
            Catalog.organization_id == organization_id,
            Catalog.status == CatalogStatus.draft,
        )
        statement = (
            self.get_base_statement()
            .where(
                Benefit.organization_id == organization_id,
                Benefit.external_id.in_(external_ids),
                Benefit.is_current.is_(False),
                or_(Benefit.catalog_id.is_(None), Benefit.catalog_id.not_in(drafts)),
            )
            .distinct(Benefit.external_id)
            .order_by(Benefit.external_id, Benefit.created_at.desc(), Benefit.id.desc())
            .options(undefer(Benefit.external_id), *self.get_eager_options())
        )
        return await self.get_all(statement)

    async def get_current_meter_credits_by_meters(
        self, organization_id: UUID, meter_ids: Sequence[UUID]
    ) -> Sequence[Benefit]:
        statement = (
            self.get_base_statement()
            .where(
                Benefit.organization_id == organization_id,
                Benefit.type == BenefitType.meter_credit,
                Benefit.properties["meter_id"]
                .as_string()
                .in_([str(meter_id) for meter_id in meter_ids]),
                Benefit.is_current,
            )
            .options(undefer(Benefit.external_id))
        )
        return await self.get_all(statement)

    def get_organization_statement(self, organization_id: UUID) -> Select[Benefit]:
        return (
            self.get_base_statement()
            .where(Benefit.organization_id == organization_id, Benefit.is_current)
            .order_by(Benefit.created_at, Benefit.id)
        )

    async def get_descriptions_excluding_types(
        self, organization_id: UUID, types: Sequence[BenefitType]
    ) -> Sequence[str]:
        statement = (
            self.get_organization_statement(organization_id)
            .where(Benefit.type.not_in(types))
            .with_only_columns(Benefit.description)
        )
        result = await self.session.execute(statement)
        return result.scalars().all()

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

    def apply_catalog_filter(
        self,
        statement: Select[Benefit],
        org_ids: set[AccessibleOrganizationID],
        catalog_id: Sequence[UUID] | None,
        catalog_status: Sequence[CatalogStatus] | None,
    ) -> Select[Benefit]:
        catalog_members = (
            select(CatalogBenefit.benefit_id)
            .join(CatalogBenefit.catalog)
            .where(
                Catalog.organization_id.in_(org_ids),
                CatalogBenefit.deleted_at.is_(None),
                Catalog.deleted_at.is_(None),
            )
        )
        if catalog_id is not None:
            statement = statement.where(
                Benefit.id.in_(catalog_members.where(Catalog.id.in_(catalog_id)))
            )
        if catalog_status is not None:
            in_status = Benefit.id.in_(
                catalog_members.where(Catalog.status.in_(catalog_status))
            )
            statement = statement.where(
                or_(Benefit.is_current, in_status)
                if CatalogStatus.live in catalog_status
                else in_status
            )
        return statement

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[Benefit]:
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
