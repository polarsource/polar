import uuid
from typing import Sequence

import structlog

from polar.actions.pull_request import PullRequestAction
from polar.integrations.github import client as github
from polar.models.pull_request import PullRequest
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.pull_request import FullPullRequestCreate, MinimalPullRequestCreate

log = structlog.get_logger()


class GithubPullRequestActions(PullRequestAction):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> PullRequest | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def store_simple(
        self,
        session: AsyncSession,
        data: github.rest.PullRequestSimple,
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> PullRequest:
        records = await self.store_many_simple(
            session,
            [data],
            organization_id=organization_id,
            repository_id=repository_id,
        )
        if records:
            return records[0]
        raise RuntimeError("failed to store pull request")

    async def store_many_simple(
        self,
        session: AsyncSession,
        data: Sequence[github.rest.PullRequestSimple],
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> list[PullRequest]:
        def parse(pr: github.rest.PullRequestSimple) -> MinimalPullRequestCreate:
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
        data: github.rest.PullRequest
        | github.webhooks.PullRequestOpenedPropPullRequest,
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
        data: Sequence[
            github.rest.PullRequest | github.webhooks.PullRequestOpenedPropPullRequest
        ],
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> list[PullRequest]:
        def parse(
            pr: github.rest.PullRequest
            | github.webhooks.PullRequestOpenedPropPullRequest,
        ) -> FullPullRequestCreate:
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


github_pull_request = GithubPullRequestActions(PullRequest)
