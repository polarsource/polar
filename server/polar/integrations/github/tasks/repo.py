from uuid import UUID

from polar.integrations.github import service
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    get_worker_redis,
    task,
)

from .utils import get_external_organization_and_repo, github_rate_limit_retry


@task("github.repo.sync.repositories")
@github_rate_limit_retry
async def sync_repositories(
    ctx: JobContext,
    organization_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            organization = await service.github_organization.get(
                session, organization_id
            )
            if not organization:
                raise Exception("organization not found")

            await service.github_repository.install_for_organization(
                session, get_worker_redis(ctx), organization
            )


@task("github.repo.sync.issues")
@github_rate_limit_retry
async def sync_repository_issues(
    ctx: JobContext,
    organization_id: UUID,
    repository_id: UUID,
    polar_context: PolarWorkerContext,
    # Override which installation to use when crawling
    crawl_with_installation_id: int | None = None,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            organization, repository = await get_external_organization_and_repo(
                session, organization_id, repository_id
            )
            await service.github_issue.sync_issues(
                session,
                get_worker_redis(ctx),
                organization=organization,
                repository=repository,
                crawl_with_installation_id=crawl_with_installation_id,
            )
