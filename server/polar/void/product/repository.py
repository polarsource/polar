from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import selectinload

from polar.kit.repository import RepositoryBase
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

    async def list(self, organization_id: UUID) -> Sequence[VoidProduct]:
        return await self.get_all(
            self.scoped_statement(organization_id).order_by(
                VoidProduct.created_at, VoidProduct.id
            )
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidProduct | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidProduct.id == id)
        )
