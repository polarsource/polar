from typing import Any, Sequence

from sqlalchemy.orm import MappedColumn

from polar.actions.base import Action
from polar.clients import github
from polar.ext.sqlalchemy.types import GUID
from polar.models.pull_request import PullRequest
from polar.platforms import Platforms
from polar.postgres import AsyncSession, sql
from polar.schema.pull_request import CreatePullRequest, UpdatePullRequest

TGithubPR = (
    github.rest.PullRequest
    | github.rest.PullRequestSimple
    | github.webhooks.PullRequestOpenedPropPullRequest
)


class PullRequestAction(Action[PullRequest, CreatePullRequest, UpdatePullRequest]):
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

    async def store(
        self,
        session: AsyncSession,
        organization_name: str,
        repository_name: str,
        data: TGithubPR,
        organization_id: GUID | None = None,
        repository_id: GUID | None = None,
    ) -> PullRequest:
        records = await self.store_many(
            session,
            organization_name,
            repository_name,
            [data],
            organization_id=organization_id,
            repository_id=repository_id,
        )
        return records[0]

    async def store_many(
        self,
        session: AsyncSession,
        organization_name: str,
        repository_name: str,
        data: Sequence[TGithubPR],
        organization_id: GUID | None = None,
        repository_id: GUID | None = None,
    ) -> list[PullRequest]:
        def parse(pr: TGithubPR) -> CreatePullRequest:
            return CreatePullRequest.from_github(
                organization_name,
                repository_name,
                pr,
                organization_id=organization_id,
                repository_id=repository_id,
            )

        create_schemas = [parse(pr) for pr in data]
        return await self.upsert_many(
            session, create_schemas, index_elements=[PullRequest.external_id]
        )


pull_request = PullRequestAction(PullRequest)
github_pull_request = GithubPullRequestActions(PullRequest)
