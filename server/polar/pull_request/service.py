from uuid import UUID
from typing import Sequence

import structlog
from sqlalchemy.orm import InstrumentedAttribute

from polar.kit.services import ResourceService
from polar.models.issue import Issue
from polar.models.issue_reference import IssueReference
from polar.models.pull_request import PullRequest
from polar.enums import Platforms
from polar.postgres import AsyncSession, sql

from .schemas import MinimalPullRequestCreate, PullRequestUpdate

log = structlog.get_logger()


class PullRequestService(
    ResourceService[PullRequest, MinimalPullRequestCreate, PullRequestUpdate]
):
    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[int]]:
        return [self.model.external_id]

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> PullRequest | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def list_by_repository(
        self, session: AsyncSession, repository_id: UUID
    ) -> Sequence[PullRequest]:
        statement = sql.select(PullRequest).where(
            PullRequest.repository_id == repository_id
        )
        res = await session.execute(statement)
        pulls = res.scalars().unique().all()
        return pulls

    async def list_referencing_issue(
        self, session: AsyncSession, issue: Issue
    ) -> Sequence[PullRequest]:
        statement = (
            sql.select(PullRequest)
            .join(IssueReference, IssueReference.pull_request_id == PullRequest.id)
            .where(IssueReference.issue_id == issue.id)
        )
        res = await session.execute(statement)
        pulls = res.scalars().unique().all()
        return pulls


pull_request = PullRequestService(PullRequest)
