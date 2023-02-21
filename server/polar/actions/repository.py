from typing import Any

import structlog
from sqlalchemy import Column

from polar.actions.base import Action
from polar.clients import github
from polar.models import Organization, Repository
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.repository import CreateRepository, UpdateRepository
from polar.tasks.github.repo import sync_repository

log = structlog.get_logger()


class RepositoryActions(Action[Repository, CreateRepository, UpdateRepository]):
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

    async def fetch_issues(
        self,
        organization: Organization,
        repository: Repository,
    ) -> list[github.rest.Issue]:
        client = github.get_app_installation_client(organization.installation_id)
        response = await client.rest.issues.async_list_for_repo(
            owner=organization.name,
            repo=repository.name,
            state="open",
            sort="updated",
            direction="desc",
        )
        github.ensure_expected_response(response)
        return response.parsed_data

    async def upsert_many(
        self,
        session: AsyncSession,
        create_schemas: list[CreateRepository],
        index_elements: list[Column[Any]] | None = None,
    ) -> list[Repository]:
        instances = await super().upsert_many(session, create_schemas, index_elements)

        # Create tasks to sync repositories (issues, pull requests, etc.)
        for instance in instances:
            sync_repository.delay(
                instance.organization_id,
                instance.organization_name,
                instance.id,
                instance.name,
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
            CreateRepository.from_github(organization, repo)
            for repo in response.parsed_data.repositories
        ]
        instances = await self.upsert_many(session, repos)
        return instances


repository = RepositoryActions(Repository)
github_repository = GithubRepositoryActions(Repository)
