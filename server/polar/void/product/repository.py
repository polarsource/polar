from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.orm import selectinload

from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models import VoidEntitlement, VoidMeter, VoidProduct


class ProductRepository(RepositoryBase[VoidProduct]):
    model = VoidProduct

    def get_base_statement(self) -> Select[tuple[VoidProduct]]:
        return select(VoidProduct).options(
            selectinload(VoidProduct.meters.and_(VoidMeter.deleted_at.is_(None))),
            selectinload(
                VoidProduct.entitlements.and_(VoidEntitlement.deleted_at.is_(None))
            ),
        )

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidProduct]]:
        return self.get_base_statement().where(
            VoidProduct.organization_id == organization_id,
            VoidProduct.deleted_at.is_(None),
        )

    async def list(
        self, organization_id: UUID, *, include_archived: bool = True
    ) -> Sequence[VoidProduct]:
        statement = self.scoped_statement(organization_id)
        if not include_archived:
            statement = statement.where(VoidProduct.archived_at.is_(None))
        return await self.get_all(
            statement.order_by(VoidProduct.created_at, VoidProduct.id)
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidProduct | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidProduct.id == id)
        )

    async def next_generation(
        self, organization_id: UUID, slug: str, version_id: str | None
    ) -> int:
        value = await self.session.scalar(
            select(func.coalesce(func.max(VoidProduct.generation_id), 0) + 1).where(
                VoidProduct.organization_id == organization_id,
                VoidProduct.slug == slug,
                VoidProduct.version_id.is_not_distinct_from(version_id),
            )
        )
        assert value is not None
        return value

    async def archive_previous(self, product: VoidProduct) -> None:
        previous = await self.get_all(
            self.scoped_statement(product.organization_id).where(
                VoidProduct.slug == product.slug,
                VoidProduct.version_id.is_not_distinct_from(product.version_id),
                VoidProduct.generation_id < product.generation_id,
                VoidProduct.archived_at.is_(None),
            )
        )
        now = utc_now()
        for item in previous:
            item.archived_at = now
