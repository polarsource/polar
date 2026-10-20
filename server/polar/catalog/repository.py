from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Catalog, CatalogMigration, CatalogProduct, Product
from polar.models.catalog import CatalogStatus


class CatalogRepository(
    RepositorySoftDeletionIDMixin[Catalog, UUID],
    RepositorySoftDeletionMixin[Catalog],
    RepositoryBase[Catalog],
):
    model = Catalog

    async def lock(self, organization_id: UUID) -> None:
        """Serialize catalog writes for an organization."""
        await pg_advisory_xact_lock(self.session, "catalog", organization_id)

    async def get_live(self, organization_id: UUID) -> Catalog | None:
        statement = self.get_base_statement().where(
            Catalog.organization_id == organization_id,
            Catalog.status == CatalogStatus.live,
        )
        return await self.get_one_or_none(statement)

    async def get_max_version(self, organization_id: UUID) -> int:
        statement = select(func.coalesce(func.max(Catalog.version), 0)).where(
            Catalog.organization_id == organization_id
        )
        result = await self.session.execute(statement)
        return result.scalar_one()


class CatalogProductRepository(
    RepositorySoftDeletionIDMixin[CatalogProduct, UUID],
    RepositorySoftDeletionMixin[CatalogProduct],
    RepositoryBase[CatalogProduct],
):
    model = CatalogProduct

    async def get_all_by_catalog(self, catalog_id: UUID) -> Sequence[CatalogProduct]:
        statement = (
            self.get_base_statement()
            .where(CatalogProduct.catalog_id == catalog_id)
            .options(joinedload(CatalogProduct.product))
        )
        return await self.get_all(statement)

    async def get_product(self, catalog_id: UUID, external_id: str) -> Product | None:
        statement = (
            select(Product)
            .join(CatalogProduct, CatalogProduct.product_id == Product.id)
            .where(
                CatalogProduct.catalog_id == catalog_id,
                CatalogProduct.external_id == external_id,
                CatalogProduct.deleted_at.is_(None),
                Product.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()


class CatalogMigrationRepository(
    RepositorySoftDeletionIDMixin[CatalogMigration, UUID],
    RepositorySoftDeletionMixin[CatalogMigration],
    RepositoryBase[CatalogMigration],
):
    model = CatalogMigration
