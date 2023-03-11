from uuid import UUID
import structlog

from polar.integrations.github import service
from polar.worker import JobContext, task
from polar.postgres import AsyncSessionLocal

from .utils import get_organization_and_repo

log = structlog.get_logger()


@task("github.repo.sync.issues")
async def sync_repository_issues(
    ctx: JobContext,
    organization_id: UUID,
    repository_id: UUID,
) -> None:
    async with AsyncSessionLocal() as session:
        organization, repository = await get_organization_and_repo(
            session, organization_id, repository_id
        )
        await service.github_repository.sync_issues(
            session, organization=organization, repository=repository
        )


@task("github.repo.sync.pull_requests")
async def sync_repository_pull_requests(
    ctx: JobContext,
    organization_id: UUID,
    repository_id: UUID,
) -> None:
    async with AsyncSessionLocal() as session:
        organization, repository = await get_organization_and_repo(
            session, organization_id, repository_id
        )
        await service.github_repository.sync_pull_requests(
            session, organization=organization, repository=repository
        )
