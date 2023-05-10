from typing import Sequence
from uuid import UUID
import structlog
from sqlalchemy.orm import InstrumentedAttribute

from polar.kit.services import ResourceService
from polar.models import Repository
from polar.postgres import AsyncSession, sql

from .schemas import RepositoryCreate, RepositoryUpdate


log = structlog.get_logger()


class RepositoryService(
    ResourceService[Repository, RepositoryCreate, RepositoryUpdate]
):
    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[int]]:
        return [self.model.external_id]

    async def list_by_organization(
        self,
        session: AsyncSession,
        organization_id: UUID,
        order_by_open_source: bool = False,
    ) -> Sequence[Repository]:
        statement = sql.select(Repository).where(
            Repository.organization_id == organization_id,
            Repository.deleted_at.is_(None),
        )
        if order_by_open_source:
            statement = statement.order_by(
                Repository.is_private, Repository.created_at.desc()
            )

        res = await session.execute(statement)
        return res.scalars().unique().all()


repository = RepositoryService(Repository)
