from collections.abc import Sequence
from datetime import datetime
from typing import NamedTuple
from uuid import UUID

from sqlalchemy import Select, delete, func, select, update
from sqlalchemy.orm import joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Benefit, Catalog, CatalogBenefit, CatalogProduct, Product
from polar.models.catalog import CatalogStatus


class CatalogMembership(NamedTuple):
    external_id: str
    catalog_id: UUID
    item_id: UUID
    name: str


class CatalogRepository(
    RepositorySoftDeletionIDMixin[Catalog, UUID],
    RepositorySoftDeletionMixin[Catalog],
    RepositoryBase[Catalog],
):
    model = Catalog

    async def lock(self, organization_id: UUID) -> None:
        """Serialize catalog writes for an organization."""
        await pg_advisory_xact_lock(self.session, "catalog", organization_id)

    async def refresh(self, catalog: Catalog) -> None:
        await self.session.refresh(catalog)

    async def get_live(self, organization_id: UUID) -> Catalog | None:
        statement = self.get_base_statement().where(
            Catalog.organization_id == organization_id,
            Catalog.status == CatalogStatus.live,
        )
        return await self.get_one_or_none(statement)

    async def get_draft(self, organization_id: UUID) -> Catalog | None:
        statement = self.get_base_statement().where(
            Catalog.organization_id == organization_id,
            Catalog.status == CatalogStatus.draft,
        )
        return await self.get_one_or_none(statement)

    async def delete(self, catalog: Catalog) -> None:
        """Delete the catalog and its memberships. The rows created in it stay,
        no longer tied to a catalog."""
        for model in (Product, Benefit):
            await self.session.execute(
                update(model)
                .where(model.catalog_id == catalog.id)
                .values(catalog_id=None)
            )
        await self.session.execute(delete(Catalog).where(Catalog.id == catalog.id))

    async def count_by_organization(self, organization_id: UUID) -> int:
        """Count the organization's catalogs, soft-deleted ones included.
        Drafts don't count, so a discarded draft leaves no gap in the names."""
        return await self.count(
            self.get_base_statement(include_deleted=True).where(
                Catalog.organization_id == organization_id,
                Catalog.status != CatalogStatus.draft,
            )
        )

    async def get_published(self, organization_id: UUID) -> Sequence[Catalog]:
        """The organization's published catalogs, oldest first."""
        statement = (
            self.get_base_statement()
            .where(
                Catalog.organization_id == organization_id,
                Catalog.status != CatalogStatus.draft,
            )
            .order_by(Catalog.published_at, Catalog.created_at, Catalog.id)
        )
        return await self.get_all(statement)

    async def get_by_organization_and_id(
        self, organization_id: UUID, id: UUID
    ) -> Catalog | None:
        statement = self.get_base_statement().where(
            Catalog.id == id, Catalog.organization_id == organization_id
        )
        return await self.get_one_or_none(statement)

    async def get_version_hashes(self, ids: Sequence[UUID]) -> dict[UUID, str | None]:
        statement = select(Catalog.id, Catalog.version_hash).where(Catalog.id.in_(ids))
        result = await self.session.execute(statement)
        return {id: version_hash for id, version_hash in result.tuples()}

    async def get_by_id_with_organization(
        self, org_ids: set[AccessibleOrganizationID], id: UUID
    ) -> Catalog | None:
        statement = (
            self.get_statement_by_org_ids(org_ids)
            .where(Catalog.id == id)
            .options(joinedload(Catalog.organization))
        )
        return await self.get_one_or_none(statement)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[Catalog]:
        return (
            self.get_base_statement()
            .where(Catalog.organization_id.in_(org_ids))
            .order_by(
                Catalog.published_at.desc(),
                Catalog.created_at.desc(),
                Catalog.id.desc(),
            )
        )


class CatalogProductRepository(
    RepositorySoftDeletionIDMixin[CatalogProduct, UUID],
    RepositorySoftDeletionMixin[CatalogProduct],
    RepositoryBase[CatalogProduct],
):
    model = CatalogProduct

    async def get_external_ids(self, catalog_id: UUID) -> set[str]:
        statement = select(CatalogProduct.external_id).where(
            CatalogProduct.catalog_id == catalog_id,
            CatalogProduct.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return set(result.scalars().all())

    def get_products_statement(self, catalog_id: UUID) -> Select[Product]:
        return (
            select(Product)
            .join(CatalogProduct, CatalogProduct.product_id == Product.id)
            .where(
                CatalogProduct.catalog_id == catalog_id,
                CatalogProduct.deleted_at.is_(None),
                Product.deleted_at.is_(None),
            )
            .order_by(Product.created_at, Product.id)
        )

    async def get_products_by_external_ids(
        self,
        catalog_id: UUID,
        external_ids: Sequence[str],
        *,
        options: Options,
    ) -> Sequence[Product]:
        statement = (
            self.get_products_statement(catalog_id)
            .where(CatalogProduct.external_id.in_(external_ids))
            .options(*options)
        )
        result = await self.session.execute(statement)
        return result.scalars().unique().all()

    async def get_memberships(
        self, catalog_ids: Sequence[UUID]
    ) -> Sequence[CatalogMembership]:
        statement = (
            select(
                CatalogProduct.external_id,
                CatalogProduct.catalog_id,
                Product.id,
                Product.name,
            )
            .join(Product, Product.id == CatalogProduct.product_id)
            .where(
                CatalogProduct.catalog_id.in_(catalog_ids),
                CatalogProduct.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return [CatalogMembership(*row) for row in result.tuples()]

    async def delete_by_catalog(self, catalog_id: UUID) -> None:
        """Delete a draft's memberships. They aren't history, and the next
        apply lists the same `external_id`s again."""
        await self.session.execute(
            delete(CatalogProduct).where(CatalogProduct.catalog_id == catalog_id)
        )

    async def get_all_by_catalog(self, catalog_id: UUID) -> Sequence[CatalogProduct]:
        statement = (
            self.get_base_statement()
            .where(CatalogProduct.catalog_id == catalog_id)
            .options(joinedload(CatalogProduct.product))
        )
        return await self.get_all(statement)


class CatalogBenefitRepository(
    RepositorySoftDeletionIDMixin[CatalogBenefit, UUID],
    RepositorySoftDeletionMixin[CatalogBenefit],
    RepositoryBase[CatalogBenefit],
):
    model = CatalogBenefit

    async def get_first_published_at(self, organization_id: UUID) -> datetime | None:
        """When the organization's first catalog listing benefits was published.

        Soft-deleted rows count too, so the boundary never moves.
        """
        statement = (
            select(func.min(Catalog.published_at))
            .join(CatalogBenefit, CatalogBenefit.catalog_id == Catalog.id)
            .where(Catalog.organization_id == organization_id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    def get_benefits_statement(self, catalog_id: UUID) -> Select[Benefit]:
        return (
            select(Benefit)
            .join(CatalogBenefit, CatalogBenefit.benefit_id == Benefit.id)
            .where(
                CatalogBenefit.catalog_id == catalog_id,
                CatalogBenefit.deleted_at.is_(None),
                Benefit.deleted_at.is_(None),
            )
            .order_by(Benefit.created_at, Benefit.id)
        )

    async def get_benefits_by_external_ids(
        self,
        catalog_id: UUID,
        external_ids: Sequence[str],
        *,
        options: Options,
    ) -> Sequence[Benefit]:
        statement = (
            self.get_benefits_statement(catalog_id)
            .where(CatalogBenefit.external_id.in_(external_ids))
            .options(*options)
        )
        result = await self.session.execute(statement)
        return result.scalars().unique().all()

    async def get_memberships(
        self, catalog_ids: Sequence[UUID]
    ) -> Sequence[CatalogMembership]:
        statement = (
            select(
                CatalogBenefit.external_id,
                CatalogBenefit.catalog_id,
                Benefit.id,
                Benefit.description,
            )
            .join(Benefit, Benefit.id == CatalogBenefit.benefit_id)
            .where(
                CatalogBenefit.catalog_id.in_(catalog_ids),
                CatalogBenefit.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return [CatalogMembership(*row) for row in result.tuples()]

    async def delete_by_catalog(self, catalog_id: UUID) -> None:
        """Delete a draft's memberships. They aren't history, and the next
        apply lists the same `external_id`s again."""
        await self.session.execute(
            delete(CatalogBenefit).where(CatalogBenefit.catalog_id == catalog_id)
        )

    async def get_all_by_catalog(self, catalog_id: UUID) -> Sequence[CatalogBenefit]:
        statement = (
            self.get_base_statement()
            .where(CatalogBenefit.catalog_id == catalog_id)
            .options(joinedload(CatalogBenefit.benefit))
        )
        return await self.get_all(statement)
