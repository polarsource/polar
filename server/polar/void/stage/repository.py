from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import RepositoryBase
from polar.models import VoidStage


class StageRepository(RepositoryBase[VoidStage]):
    model = VoidStage

    async def get(
        self, organization_id: UUID, *, include_deleted: bool = False
    ) -> VoidStage | None:
        statement = select(VoidStage).where(
            VoidStage.organization_id == organization_id
        )
        if not include_deleted:
            statement = statement.where(VoidStage.deleted_at.is_(None))
        return await self.get_one_or_none(
            statement.execution_options(populate_existing=True)
        )
