from uuid import UUID
import structlog
from polar.integrations.github import service
from polar.kit.extensions.sqlalchemy import sql

from polar.worker import JobContext, PolarWorkerContext, enqueue_job, interval, task
from polar.postgres import AsyncSessionLocal

from .utils import get_organization_and_repo
from ..service.issue import github_issue

log = structlog.get_logger()


@task("github.issue.sync.issue_references")
async def issue_sync_issue_references(
    ctx: JobContext,
    issue_id: UUID,
    polar_context: PolarWorkerContext,
    crawl_with_installation_id: int
    | None = None,  # Override which installation to use when crawling
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            issue = await github_issue.get(session, issue_id)
            if not issue or not issue.organization_id or not issue.repository_id:
                log.warning(
                    "github.issue.sync.issue_references",
                    error="issue not found",
                    issue_id=issue_id,
                )
                return

            organization, repository = await get_organization_and_repo(
                session, issue.organization_id, issue.repository_id
            )

            await service.github_reference.sync_issue_references(
                session,
                org=organization,
                repo=repository,
                issue=issue,
                crawl_with_installation_id=crawl_with_installation_id,
            )


@task("github.issue.sync.issue_dependencies")
async def issue_sync_issue_dependencies(
    ctx: JobContext,
    issue_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context() as context:
        async with AsyncSessionLocal() as session:
            issue = await github_issue.get(session, issue_id)
            if not issue or not issue.organization_id or not issue.repository_id:
                log.warning(
                    "github.issue.sync.issue_dependencies",
                    error="issue not found",
                    issue_id=issue_id,
                )
                return

            organization, repository = await get_organization_and_repo(
                session, issue.organization_id, issue.repository_id
            )

            await service.github_dependency.sync_issue_dependencies(
                session,
                org=organization,
                repo=repository,
                issue=issue,
            )


@interval(
    minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55},
    second=0,
)
async def cron_refresh_issue_timelines(ctx: JobContext) -> None:
    async with AsyncSessionLocal() as session:
        issues = await github_issue.list_issues_to_crawl_timeline(session)

        log.info(
            "github.issue.sync.cron_refresh_issue_timelines",
            found_count=len(issues),
        )

        for issue in issues:
            await enqueue_job("github.issue.sync.issue_references", issue.id)
