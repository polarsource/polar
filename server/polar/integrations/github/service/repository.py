from collections.abc import Sequence

import structlog

from polar.enums import Platforms
from polar.integrations.loops.service import loops as loops_service
from polar.logging import Logger
from polar.models import Organization, Repository
from polar.postgres import AsyncSession
from polar.repository.schemas import RepositoryCreate, RepositoryUpdate
from polar.repository.service import RepositoryService
from polar.worker import enqueue_job

from .. import client as github

log: Logger = structlog.get_logger()


class GithubRepositoryService(RepositoryService):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Repository | None:
        return await self.get_by(
            session, platform=Platforms.github, external_id=external_id
        )

    async def enqueue_sync(
        self,
        repository: Repository,
        crawl_with_installation_id: int
        | None = None,  # Override which installation to use when crawling
    ) -> None:
        await enqueue_job(
            "github.repo.sync.issues",
            repository.organization_id,
            repository.id,
            crawl_with_installation_id=crawl_with_installation_id,
        )
        await enqueue_job(
            "github.repo.sync.pull_requests",
            repository.organization_id,
            repository.id,
            crawl_with_installation_id=crawl_with_installation_id,
        )

    async def install_for_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        installation_id: int,
    ) -> Sequence[Repository] | None:
        client = github.get_app_installation_client(installation_id)

        instances = []

        async for repo in client.paginate(
            client.rest.apps.async_list_repos_accessible_to_installation,
            map_func=lambda r: r.parsed_data.repositories,
        ):
            create = RepositoryCreate.from_github(repo, organization.id)
            inst = await self.create_or_update(session, create)

            # un-delete if previously deleted
            if inst.deleted_at is not None:
                inst.deleted_at = None
                await inst.save(session, autocommit=False)

            instances.append(inst)

        if len(instances) > 0:
            await loops_service.repository_installed_on_organization(
                session, organization=organization
            )

        await session.commit()
        for installation in instances:
            await self.enqueue_sync(installation)
        return instances

    async def create_or_update_from_github(
        self,
        session: AsyncSession,
        organization: Organization,
        data: github.models.Repository
        | github.models.FullRepository
        | github.models.WebhookIssuesTransferredPropChangesPropNewRepository,
    ) -> Repository:
        repository = await self.get_by_external_id(session, data.id)

        if not repository:
            log.debug(
                "repository not found by external_id, creating it",
                external_id=data.id,
            )

            repository = await self.create(
                session, RepositoryCreate.from_github(data, organization.id)
            )
        else:
            log.debug(
                "repository found by external_id, updating it",
                external_id=data.id,
            )
            repository = await self.update(
                session,
                repository,
                RepositoryUpdate.from_github(data, organization.id),
                exclude_unset=True,
            )

        return repository


github_repository = GithubRepositoryService(Repository)
