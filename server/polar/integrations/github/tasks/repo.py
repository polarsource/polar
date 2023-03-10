from uuid import UUID
import structlog

from polar.integrations.github import service
from polar.worker import task

from .utils import get_organization_and_repo

log = structlog.get_logger()


@task(name="github.repo.sync.issues", bind=True)
async def sync_repository_issues(
    self,
    organization_id: UUID,
    repository_id: UUID,
) -> None:
    async with self.get_db_session() as session:
        organization, repository = await get_organization_and_repo(
            session, organization_id, repository_id
        )
        await service.github_repository.sync_issues(
            session, organization=organization, repository=repository
        )


@task(name="github.repo.sync.pull_requests", bind=True)
async def sync_repository_pull_requests(
    self,
    organization_id: UUID,
    repository_id: UUID,
) -> None:
    async with self.get_db_session() as session:
        organization, repository = await get_organization_and_repo(
            session, organization_id, repository_id
        )
        await service.github_repository.sync_pull_requests(
            session, organization=organization, repository=repository
        )


@task(name="github.repo.sync")
async def sync_repository(
    organization_id: UUID,
    repository_id: UUID,
) -> None:
    # TODO: A bit silly to call a task scheduling... tasks.
    # Should the invocation of this function skip .delay?
    sync_repository_issues.delay(organization_id, repository_id)
    # sync_repository_pull_requests.delay(organization_id, repository_id)
