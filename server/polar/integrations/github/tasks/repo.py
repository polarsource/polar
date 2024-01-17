from uuid import UUID

import structlog

from polar.integrations.github import service
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    enqueue_job,
    task,
)

from .utils import get_organization_and_repo, github_rate_limit_retry

log = structlog.get_logger()


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
                session, organization, organization.safe_installation_id
            )


@task("github.repo.sync.issues")
@github_rate_limit_retry
async def sync_repository_issues(
    ctx: JobContext,
    organization_id: UUID,
    repository_id: UUID,
    polar_context: PolarWorkerContext,
    crawl_with_installation_id: int
    | None = None,  # Override which installation to use when crawling
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            organization, repository = await get_organization_and_repo(
                session, organization_id, repository_id
            )
            await service.github_issue.sync_issues(
                session,
                organization=organization,
                repository=repository,
                crawl_with_installation_id=crawl_with_installation_id,
            )


@task("github.repo.sync.pull_requests")
@github_rate_limit_retry
async def sync_repository_pull_requests(
    ctx: JobContext,
    organization_id: UUID,
    repository_id: UUID,
    polar_context: PolarWorkerContext,
    crawl_with_installation_id: int | None = None,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            organization, repository = await get_organization_and_repo(
                session, organization_id, repository_id
            )
            await service.github_pull_request.sync_pull_requests(
                session,
                organization=organization,
                repository=repository,
                crawl_with_installation_id=crawl_with_installation_id,
            )
            await enqueue_job(
                "github.repo.sync.issue_references",
                organization.id,
                repository.id,
                crawl_with_installation_id=crawl_with_installation_id,
            )


@task("github.repo.sync.issue_references")
@github_rate_limit_retry
async def repo_sync_issue_references(
    ctx: JobContext,
    organization_id: UUID,
    repository_id: UUID,
    polar_context: PolarWorkerContext,
    crawl_with_installation_id: int | None = None,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            organization, repository = await get_organization_and_repo(
                session, organization_id, repository_id
            )
            await service.github_reference.sync_repo_references(
                session,
                org=organization,
                repo=repository,
                crawl_with_installation_id=crawl_with_installation_id,
            )
