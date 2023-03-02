import uuid
from typing import Any, Sequence

import structlog
from sqlalchemy.orm import MappedColumn

from polar.actions.base import Action
from polar.clients import github
from polar.ext.sqlalchemy.types import GUID
from polar.models.pull_request import PullRequest
from polar.platforms import Platforms
from polar.postgres import AsyncSession, sql
from polar.schema.pull_request import (
    CreateFullPullRequest,
    CreateMinimalPullRequest,
    UpdatePullRequest,
)

log = structlog.get_logger()


class PullRequestAction(
    Action[PullRequest, CreateMinimalPullRequest, UpdatePullRequest]
):
    @property
    def default_upsert_index_elements(self) -> list[MappedColumn[Any]]:
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
        def parse(pr: github.rest.PullRequestSimple) -> CreateMinimalPullRequest:
            return CreateMinimalPullRequest.minimal_pull_request_from_github(
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
            index_elements=[PullRequest.external_id],
            mutable_keys=CreateMinimalPullRequest.__mutable_keys__,
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
        ) -> CreateFullPullRequest:
            return CreateFullPullRequest.full_pull_request_from_github(
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
            index_elements=[PullRequest.external_id],
            mutable_keys=CreateFullPullRequest.__mutable_keys__,
        )


pull_request = PullRequestAction(PullRequest)
github_pull_request = GithubPullRequestActions(PullRequest)
