import uuid
from typing import Sequence

import structlog

from polar.models.pull_request import PullRequest
from polar.enums import Platforms
from polar.postgres import AsyncSession
from polar.pull_request.schemas import FullPullRequestCreate, MinimalPullRequestCreate
from polar.pull_request.service import PullRequestService

from ..types import GithubPullRequestFull, GithubPullRequestSimple

log = structlog.get_logger()


class GithubPullRequestService(PullRequestService):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> PullRequest | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def store_simple(
        self,
        session: AsyncSession,
        *,
        data: GithubPullRequestSimple,
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> PullRequest:
        records = await self.store_many_simple(
            session,
            data=[data],
            organization_id=organization_id,
            repository_id=repository_id,
        )
        if records:
            return records[0]
        raise RuntimeError("failed to store pull request")

    async def store_many_simple(
        self,
        session: AsyncSession,
        *,
        data: Sequence[GithubPullRequestSimple],
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> list[PullRequest]:
        def parse(pr: GithubPullRequestSimple) -> MinimalPullRequestCreate:
            return MinimalPullRequestCreate.minimal_pull_request_from_github(
                pr,
                organization_id=organization_id,
                repository_id=repository_id,
            )

        create_schemas = [parse(pr) for pr in data]
        if not create_schemas:
            log.warning(
                "github.pull_request",
                error="no pull requests to store",
                organization_id=organization_id,
                repository_id=repository_id,
            )
            return []

        return await self.upsert_many(
            session,
            create_schemas,
            constraints=[PullRequest.external_id],
            mutable_keys=MinimalPullRequestCreate.__mutable_keys__,
        )

    async def store_full(
        self,
        session: AsyncSession,
        data: GithubPullRequestFull,
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> PullRequest:
        records = await self.store_many_full(
            session,
            [data],
            organization_id=organization_id,
            repository_id=repository_id,
        )
        if records:
            return records[0]
        raise RuntimeError("failed to store pull request")

    async def store_many_full(
        self,
        session: AsyncSession,
        data: Sequence[GithubPullRequestFull],
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> list[PullRequest]:
        def parse(pr: GithubPullRequestFull) -> FullPullRequestCreate:
            return FullPullRequestCreate.full_pull_request_from_github(
                pr,
                organization_id=organization_id,
                repository_id=repository_id,
            )

        create_schemas = [parse(pr) for pr in data]
        if not create_schemas:
            log.warning(
                "github.pull_request",
                error="no pull requests to store",
                organization_id=organization_id,
                repository_id=repository_id,
            )
            return []

        return await self.upsert_many(
            session,
            create_schemas,
            constraints=[PullRequest.external_id],
            mutable_keys=FullPullRequestCreate.__mutable_keys__,
        )


github_pull_request = GithubPullRequestService(PullRequest)
