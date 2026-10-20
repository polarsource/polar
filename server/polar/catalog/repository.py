from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import Catalog, CatalogMigration, CatalogProduct, Product
from polar.models.catalog import CatalogStatus


class CatalogRepository(RepositoryBase[Catalog], RepositoryIDMixin[Catalog, UUID]):
    model = Catalog

    async def get_live(self, organization_id: UUID) -> Catalog | None:
        statement = self.get_base_statement().where(
            Catalog.organization_id == organization_id,
            Catalog.status == CatalogStatus.live,
        )
        return await self.get_one_or_none(statement)

    async def get_by_version(
        self, organization_id: UUID, version: int
    ) -> Catalog | None:
        statement = self.get_base_statement().where(
            Catalog.organization_id == organization_id,
            Catalog.version == version,
        )
        return await self.get_one_or_none(statement)

    async def get_max_version(self, organization_id: UUID) -> int:
        statement = select(func.coalesce(func.max(Catalog.version), 0)).where(
            Catalog.organization_id == organization_id
        )
        result = await self.session.execute(statement)
        return result.scalar_one()


class CatalogProductRepository(
    RepositoryBase[CatalogProduct], RepositoryIDMixin[CatalogProduct, UUID]
):
    model = CatalogProduct

    async def get_all_by_catalog(self, catalog_id: UUID) -> Sequence[CatalogProduct]:
        statement = self.get_base_statement().where(
            CatalogProduct.catalog_id == catalog_id
        )
        return await self.get_all(statement)

    async def get_product(self, catalog_id: UUID, external_id: str) -> Product | None:
        statement = (
            select(Product)
            .join(CatalogProduct, CatalogProduct.product_id == Product.id)
            .where(
                CatalogProduct.catalog_id == catalog_id,
                CatalogProduct.external_id == external_id,
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()


class CatalogMigrationRepository(
    RepositoryBase[CatalogMigration], RepositoryIDMixin[CatalogMigration, UUID]
):
    model = CatalogMigration

    async def get_by_external_id(
        self, organization_id: UUID, external_id: str
    ) -> CatalogMigration | None:
        statement = self.get_base_statement().where(
            CatalogMigration.organization_id == organization_id,
            CatalogMigration.external_id == external_id,
        )
        return await self.get_one_or_none(statement)
