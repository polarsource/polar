from uuid import UUID

import structlog

from polar.integrations.github.tasks.utils import github_rate_limit_retry
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    QueueName,
    enqueue_job,
    interval,
    task,
)

from ..service.organization import github_organization as github_organization_service

log = structlog.get_logger()


@interval(
    hour=10,
    minute=19,
    second=0,
)
async def cron_org_metadata(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        orgs = await github_organization_service.list_installed(session)
        for org in orgs:
            enqueue_job(
                "github.organization.populate_org_metadata",
                organization_id=org.id,
                queue_name=QueueName.github_crawl,
            )


@task("github.organization.populate_org_metadata")
@github_rate_limit_retry
async def populate_org_metadata(
    ctx: JobContext,
    organization_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            org = await github_organization_service.get(session, organization_id)
            if not org:
                return

            log.info(
                "github.organization.populate_org_metadata",
                organization_id=organization_id,
            )

            await github_organization_service.populate_org_metadata(session, org)
