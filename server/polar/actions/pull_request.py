from typing import Sequence

import structlog
from sqlalchemy.orm import InstrumentedAttribute

from polar.actions.base import Action
from polar.ext.sqlalchemy.types import GUID
from polar.models.pull_request import PullRequest
from polar.platforms import Platforms
from polar.postgres import AsyncSession, sql
from polar.schema.pull_request import MinimalPullRequestCreate, PullRequestUpdate

log = structlog.get_logger()


class PullRequestAction(
    Action[PullRequest, MinimalPullRequestCreate, PullRequestUpdate]
):
    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[int]]:
        return [self.model.external_id]

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> PullRequest | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def list_by_repository(
        self, session: AsyncSession, repository_id: GUID
    ) -> Sequence[PullRequest]:
        statement = sql.select(PullRequest).where(
            PullRequest.repository_id == repository_id
        )
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues


pull_request = PullRequestAction(PullRequest)
