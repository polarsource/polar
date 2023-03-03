from typing import Any, AsyncGenerator, Literal

import structlog
from sqlalchemy import Column

from polar.actions.base import Action
from polar.actions.issue import github_issue
from polar.actions.pull_request import github_pull_request
from polar.clients import github
from polar.models import Issue, Organization, PullRequest, Repository
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.repository import RepositoryCreate, RepositoryUpdate
from polar.tasks.github.repo import sync_repository

log = structlog.get_logger()


class RepositoryActions(Action[Repository, RepositoryCreate, RepositoryUpdate]):
    @property
    def default_upsert_index_elements(self) -> list[Column[Any]]:
        return [self.model.external_id]


class GithubRepositoryActions(RepositoryActions):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Repository | None:
        return await self.get_by(
            session, platform=Platforms.github, external_id=external_id
        )

    async def sync_issues(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        state: Literal["open", "closed", "all"] = "open",
        sort: Literal["created", "updated", "comments"] = "updated",
        direction: Literal["asc", "desc"] = "desc",
        per_page: int = 30,
    ) -> AsyncGenerator[Issue, None]:
        client = github.get_app_installation_client(organization.installation_id)
        async for gh_issue in client.paginate(
            client.rest.issues.async_list_for_repo,
            owner=organization.name,
            repo=repository.name,
            state=state,
            sort=sort,
            direction=direction,
            per_page=per_page,
        ):
            if not gh_issue:
                break

            record = await github_issue.store(
                session,
                gh_issue,
                organization_id=organization.id,
                repository_id=repository.id,
            )
            if record:
                yield record

    async def sync_pull_requests(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        state: Literal["open", "closed", "all"] = "open",
        sort: Literal["created", "updated", "popularity", "long-running"] = "updated",
        direction: Literal["asc", "desc"] = "desc",
        per_page: int = 30,
    ) -> AsyncGenerator[PullRequest, None]:
        client = github.get_app_installation_client(organization.installation_id)
        async for gh_pull in client.paginate(
            client.rest.pulls.async_list,
            owner=organization.name,
            repo=repository.name,
            state=state,
            sort=sort,
            direction=direction,
            per_page=per_page,
        ):
            if not gh_pull:
                break

            record = await github_pull_request.store_simple(
                session,
                gh_pull,
                organization_id=organization.id,
                repository_id=repository.id,
            )
            if record:
                yield record

    async def upsert_many(
        cls,
        session: AsyncSession,
        create_schemas: list[RepositoryCreate],
        index_elements: list[Column[Any]] | None = None,
        mutable_keys: set[str] | None = None,
    ) -> list[Repository]:
        instances = await super().upsert_many(
            session, create_schemas, index_elements, mutable_keys
        )

        # Create tasks to sync repositories (issues, pull requests, etc.)
        for instance in instances:
            sync_repository.delay(
                instance.organization_id,
                instance.id,
            )
        return instances

    async def install_for_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        installation_id: int,
    ) -> list[Repository] | None:
        client = github.get_app_installation_client(installation_id)
        response = await client.rest.apps.async_list_repos_accessible_to_installation()
        github.ensure_expected_response(response)

        repos = [
            RepositoryCreate.from_github(organization, repo)
            for repo in response.parsed_data.repositories
        ]
        instances = await self.upsert_many(session, repos)
        return instances


repository = RepositoryActions(Repository)
github_repository = GithubRepositoryActions(Repository)
