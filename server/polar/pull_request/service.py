from uuid import UUID
from typing import Sequence
from sqlalchemy import or_

import structlog
from sqlalchemy.orm import InstrumentedAttribute

from polar.kit.services import ResourceService
from polar.models.pull_request import PullRequest
from polar.enums import Platforms
from polar.postgres import AsyncSession, sql

from .schemas import MinimalPullRequestCreate, PullRequestUpdate
import re

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

    async def list_by_repository_for_issue(
        self, session: AsyncSession, repository_id: UUID, issueNumber: int
    ) -> Sequence[PullRequest]:
        statement = sql.select(PullRequest).where(
            PullRequest.repository_id == repository_id,
            or_(
                PullRequest.title.like(f"%#{issueNumber}%"),
                PullRequest.body.like(f"%#{issueNumber}%"),
            ),
        )

        res = await session.execute(statement)
        pulls = res.scalars().unique().all()

        # TODO: support finding links to issues across repositories:
        # See https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls
        #
        # "https://github.com/zegl/polartest/issues/40"
        # "zegl/polartest#40"

        # Additional filter
        # Make sure that search for issue 3 does not match pull requests mentioning "#33" etc.
        def matches(pr: PullRequest) -> bool:
            # pattern = f"(Close|Closes|Closed|Fix|Fixes|Fixed|Resolve|Resolves|Resolved) #{issueNumber}(?![0-9])"
            pattern = f"#{issueNumber}(?![0-9])"
            if re.search(pattern, pr.title, re.IGNORECASE) is not None:
                return True
            if pr.body and re.search(pattern, pr.body, re.IGNORECASE) is not None:
                return True
            return False

        pulls = [pr for pr in pulls if matches(pr)]

        return pulls


pull_request = PullRequestService(PullRequest)
