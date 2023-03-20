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
    ) -> Sequence[Repository]:
        statement = sql.select(Repository).where(
            Repository.organization_id == organization_id
        )
        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def get_by_organization_and_name(
        self,
        session: AsyncSession,
        organization_id: UUID,
        name: str,
    ) -> Repository | None:
        statement = sql.select(Repository).where(
            Repository.organization_id == organization_id,
            Repository.name == name,
        )
        res = await session.execute(statement)
        return res.scalars().unique().first()


repository = RepositoryService(Repository)
