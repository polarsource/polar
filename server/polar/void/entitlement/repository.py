from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select

from polar.kit.repository import RepositoryBase
from polar.models import VoidEntitlement, VoidEvent, VoidReducer


class EntitlementRepository(RepositoryBase[VoidEntitlement]):
    model = VoidEntitlement

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidEntitlement]]:
        return self.get_base_statement().where(
            VoidEntitlement.organization_id == organization_id,
            VoidEntitlement.deleted_at.is_(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidEntitlement]:
        statement = self.scoped_statement(organization_id)
        return await self.get_all(
            statement.order_by(VoidEntitlement.slug, VoidEntitlement.id)
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidEntitlement | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidEntitlement.id == id)
        )

    async def get_by_slug(
        self, organization_id: UUID, slug: str, *, include_deleted: bool = False
    ) -> VoidEntitlement | None:
        statement = self.get_base_statement().where(
            VoidEntitlement.organization_id == organization_id,
            VoidEntitlement.slug == slug,
        )
        if not include_deleted:
            statement = statement.where(VoidEntitlement.deleted_at.is_(None))
        return await self.get_one_or_none(statement)

    async def assignment_reducer(self, organization_id: UUID) -> VoidReducer | None:
        return await self.session.scalar(
            select(VoidReducer).where(
                VoidReducer.organization_id == organization_id,
                VoidReducer.slug == "void-identity-entitlements",
                VoidReducer.deleted_at.is_(None),
            )
        )

    async def assignment_event(
        self, organization_id: UUID, external_id: str
    ) -> VoidEvent | None:
        return await self.session.scalar(
            select(VoidEvent).where(
                VoidEvent.organization_id == organization_id,
                VoidEvent.external_id == external_id,
            )
        )
