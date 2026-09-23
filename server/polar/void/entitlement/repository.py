from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select

from polar.kit.repository import RepositoryBase
from polar.models import Benefit, VoidReducer
from polar.models import Event as EventModel
from polar.models.benefit import BenefitType


class EntitlementRepository(RepositoryBase[Benefit]):
    model = Benefit

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[Benefit]]:
        return self.get_base_statement().where(
            Benefit.organization_id == organization_id,
            Benefit.deleted_at.is_(None),
            Benefit.type == BenefitType.feature_flag,
            Benefit.slug.is_not(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[Benefit]:
        statement = self.scoped_statement(organization_id)
        return await self.get_all(statement.order_by(Benefit.slug, Benefit.id))

    async def get(self, organization_id: UUID, id: UUID) -> Benefit | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(Benefit.id == id)
        )

    async def get_by_slug(
        self, organization_id: UUID, slug: str, *, include_deleted: bool = False
    ) -> Benefit | None:
        statement = self.get_base_statement().where(
            Benefit.organization_id == organization_id,
            Benefit.slug == slug,
        )
        if not include_deleted:
            statement = statement.where(Benefit.deleted_at.is_(None))
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
    ) -> EventModel | None:
        return await self.session.scalar(
            select(EventModel).where(
                EventModel.organization_id == organization_id,
                EventModel.external_id == external_id,
            )
        )
