from uuid import UUID
import structlog
from polar.dashboard.schemas import IssueListType

from polar.worker import JobContext, PolarWorkerContext, enqueue_job, task
from polar.postgres import AsyncSessionLocal

from .utils import get_organization_and_repo
from ..service.issue import github_issue
from polar.repository.service import repository
from polar.issue.service import issue

log = structlog.get_logger()


@task("github.badge.embed_on_issue")
async def embed_badge(
    ctx: JobContext,
    issue_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            issue = await github_issue.get(session, issue_id)
            if not issue or not issue.organization_id or not issue.repository_id:
                log.warning(
                    "github.badge.embed_on_issue",
                    error="issue not found",
                    issue_id=issue_id,
                )
                return

            organization, repository = await get_organization_and_repo(
                session, issue.organization_id, issue.repository_id
            )
            await github_issue.embed_badge(
                session, organization=organization, repository=repository, issue=issue
            )


@task("github.badge.embed_retroactively_on_organization")
async def embed_badge_retroactively_on_organization(
    ctx: JobContext,
    organization_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            repos = await repository.list_by_organization(session, organization_id)
            for repo in repos:
                await enqueue_job(
                    "github.badge.embed_retroactively_on_repository",
                    organization_id,
                    repo.id,
                )


@task("github.badge.embed_retroactively_on_repository")
async def embed_badge_retroactively_on_repository(
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

            issues = await issue.list_by_repository_type_and_status(
                session=session,
                repository_ids=[repository.id],
                issue_list_type=IssueListType.issues,
                sort_by_recently_updated=True,
            )

            for i in reversed(issues):
                await github_issue.embed_badge(
                    session, organization=organization, repository=repository, issue=i
                )


@task("github.badge.remove_on_organization")
async def remove_badges_on_organization(
    ctx: JobContext,
    organization_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            repos = await repository.list_by_organization(session, organization_id)
            for repo in repos:
                await enqueue_job(
                    "github.badge.remove_on_repository",
                    organization_id,
                    repo.id,
                )


@task("github.badge.remove_on_repository")
async def remove_badges_on_repository(
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

            issues = await issue.list_by_repository_type_and_status(
                session=session,
                repository_ids=[repository.id],
                issue_list_type=IssueListType.issues,
                include_closed=True,  # Remove badge on closed issues too
                sort_by_recently_updated=True,
            )

            for i in reversed(issues):
                await github_issue.remove_badge(
                    session, organization=organization, repository=repository, issue=i
                )
