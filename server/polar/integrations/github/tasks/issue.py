import random
from uuid import UUID

import structlog

from polar.integrations.github.client import get_app_installation_client
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    JobContext,
    PolarWorkerContext,
    QueueName,
    enqueue_job,
    task,
)

from ..service.api import github_api
from ..service.issue import github_issue
from ..service.organization import github_organization as github_organization_service
from .utils import get_external_organization_and_repo, github_rate_limit_retry

log = structlog.get_logger()


@task("github.issue.sync")
@github_rate_limit_retry
async def issue_sync(
    ctx: JobContext,
    issue_id: UUID,
    polar_context: PolarWorkerContext,
    crawl_with_installation_id: int
    | None = None,  # Override which installation to use when crawling
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            issue = await github_issue.get(session, issue_id)
            if not issue or not issue.organization_id or not issue.repository_id:
                log.warning(
                    "github.issue.sync",
                    error="issue not found",
                    issue_id=issue_id,
                )
                return

            organization, repository = await get_external_organization_and_repo(
                session, issue.organization_id, issue.repository_id
            )

            await github_issue.sync_issue(
                session,
                org=organization,
                repo=repository,
                issue=issue,
                crawl_with_installation_id=crawl_with_installation_id,
            )


@task(
    "github.issue.sync.cron_refresh_issues",
    cron_trigger=CronTrigger(hour=1, minute=0),
    cron_trigger_queue=QueueName.github_crawl,
)
@github_rate_limit_retry
async def cron_refresh_issues(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        orgs = await github_organization_service.list_installed(session)
        for org in orgs:
            issues = await github_issue.list_issues_to_crawl_issue(session, org)
            if len(issues) == 0:
                log.info(
                    "github.issue.sync.cron_refresh_issues",
                    org_name=org.name,
                    found_count=len(issues),
                )
                continue

            client = get_app_installation_client(org.safe_installation_id)
            try:
                rate_limit = await github_api.get_rate_limit(client)
            except Exception as e:
                log.info(
                    "failed to get rate limit, treating it as no remaining",
                    org_name=org.name,
                    err=e,
                )
                continue

            if rate_limit.remaining < 1000:
                log.info(
                    "github.issue.sync.cron_refresh_issues.rate_limit_almost_exhausted",
                    org_name=org.name,
                    rate_limit_remaining=rate_limit.remaining,
                )
                continue

            log.info(
                "github.issue.sync.cron_refresh_issues",
                org_name=org.name,
                found_count=len(issues),
                rate_limit_remaining=rate_limit.remaining,
            )

            for issue in issues:
                enqueue_job(
                    "github.issue.sync",
                    issue.id,
                    _job_id=f"github.issue.sync:{issue.id}",
                    _defer_by=random.randint(0, 60 * 5),
                    queue_name=QueueName.github_crawl,
                )
