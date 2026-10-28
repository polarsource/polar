from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload

from polar.authz.types import AccessibleOrganizationID
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

    async def count_by_organization(self, organization_id: UUID) -> int:
        """Count the organization's catalogs, soft-deleted ones included."""
        return await self.count(
            self.get_base_statement(include_deleted=True).where(
                Catalog.organization_id == organization_id
            )
        )

    async def get_version_hashes(self, ids: Sequence[UUID]) -> dict[UUID, str | None]:
        statement = select(Catalog.id, Catalog.version_hash).where(Catalog.id.in_(ids))
        result = await self.session.execute(statement)
        return {id: version_hash for id, version_hash in result.tuples()}

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Catalog]]:
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

    async def get_all_by_catalog(self, catalog_id: UUID) -> Sequence[CatalogProduct]:
        statement = (
            self.get_base_statement()
            .where(CatalogProduct.catalog_id == catalog_id)
            .options(joinedload(CatalogProduct.product))
        )
        return await self.get_all(statement)

    async def get_product_ids_by_catalog(self, catalog_id: UUID) -> dict[str, UUID]:
        statement = (
            select(CatalogProduct.external_id, CatalogProduct.product_id)
            .where(
                CatalogProduct.catalog_id == catalog_id,
                CatalogProduct.deleted_at.is_(None),
            )
            .order_by(CatalogProduct.external_id)
        )
        result = await self.session.execute(statement)
        return dict(result.tuples().all())
