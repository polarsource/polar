from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select

from polar.kit.repository import RepositoryBase
from polar.models import VoidMeter


class MeterRepository(RepositoryBase[VoidMeter]):
    model = VoidMeter

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidMeter]]:
        return self.get_base_statement().where(
            VoidMeter.organization_id == organization_id,
            VoidMeter.deleted_at.is_(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidMeter]:
        statement = self.scoped_statement(organization_id)
        return await self.get_all(
            statement.order_by(VoidMeter.created_at, VoidMeter.id)
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidMeter | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidMeter.id == id)
        )

    async def next_generation(
        self,
        organization_id: UUID,
        slug: str,
        variant_id: str | None,
        branch_id: UUID | None,
    ) -> int:
        value = await self.session.scalar(
            select(func.coalesce(func.max(VoidMeter.generation_id), 0) + 1).where(
                VoidMeter.organization_id == organization_id,
                VoidMeter.slug == slug,
                VoidMeter.variant_id.is_not_distinct_from(variant_id),
                VoidMeter.branch_id.is_not_distinct_from(branch_id),
            )
        )
        assert value is not None
        return value
