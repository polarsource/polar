from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Catalog, CatalogProduct
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

    async def get_hashes(self, ids: Sequence[UUID]) -> dict[UUID, str]:
        statement = select(Catalog.id, Catalog.hash).where(Catalog.id.in_(ids))
        result = await self.session.execute(statement)
        return {id: hash for id, hash in result.tuples()}


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
