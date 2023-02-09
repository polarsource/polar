from typing import Any

from sqlalchemy.orm import MappedColumn

from polar.actions.base import Action
from polar.models.pull_request import PullRequest
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.pull_request import CreatePullRequest, UpdatePullRequest


class PullRequestAction(Action[PullRequest, CreatePullRequest, UpdatePullRequest]):
    @property
    def default_upsert_index_elements(self) -> list[MappedColumn[Any]]:
        return [self.model.external_id]

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> PullRequest | None:
        return await self.get_by(session, platform=platform, external_id=external_id)


class GithubPullRequestActions(PullRequestAction):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> PullRequest | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def store_many(
        self,
        session: AsyncSession,
        organization_name: str,
        repository_name: str,
        data: list[dict[str, Any]],
        organization_id: str | None = None,
        repository_id: str | None = None,
    ) -> list[PullRequest]:
        def parse(pr: dict[str, Any]) -> CreatePullRequest:
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
