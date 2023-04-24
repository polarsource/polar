from uuid import UUID
import structlog
from polar.context import ExecutionContext

from polar.integrations.github import service
from polar.worker import JobContext, PolarWorkerContext, enqueue_job, task
from polar.postgres import AsyncSessionLocal

from .utils import get_organization_and_repo

log = structlog.get_logger()


@task("github.repo.sync.repositories")
async def sync_repositories(
    ctx: JobContext,
    organization_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            organization = await service.github_organization.get(
                session, organization_id
            )
            if not organization:
                raise Exception("organization not found")

            await service.github_repository.install_for_organization(
                session, organization, organization.installation_id
            )


@task("github.repo.sync.issues")
async def sync_repository_issues(
    ctx: JobContext,
    organization_id: UUID,
    repository_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context() as context:
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
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            organization, repository = await get_organization_and_repo(
                session, organization_id, repository_id
            )
            await service.github_repository.sync_pull_requests(
                session,
                organization=organization,
                repository=repository,
            )
            await enqueue_job(
                "github.repo.sync.issue_references", organization.id, repository.id
            )


@task("github.repo.sync.issue_references")
async def repo_sync_issue_references(
    ctx: JobContext,
    organization_id: UUID,
    repository_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            organization, repository = await get_organization_and_repo(
                session, organization_id, repository_id
            )
            await service.github_reference.sync_repo_references(
                session,
                org=organization,
                repo=repository,
            )
