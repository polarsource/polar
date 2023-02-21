from typing import Any

import structlog
from sqlalchemy import Column

from polar.actions.base import Action
from polar.clients import github
from polar.models import Organization, Repository
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.repository import CreateRepository, UpdateRepository

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

    async def install_for_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        installation_id: int,
    ) -> list[Repository] | None:
        client = github.get_app_installation_client(installation_id)
        response = await client.rest.apps.async_list_repos_accessible_to_installation()
        github.ensure_expected_response(response)

        installed = []
        for repo in response.parsed_data.repositories:
            created = await self.install(session, organization, repo)
            installed.append(created)
        return installed

    async def install(
        self,
        session: AsyncSession,
        organization: Organization,
        repo: github.rest.Repository,
    ) -> Repository:
        create = CreateRepository.from_github(organization, repo)
        instance = await self.upsert(session, create)
        # TODO: Schedule a task to sync issues
        return instance


repository = RepositoryActions(Repository)
github_repository = GithubRepositoryActions(Repository)
