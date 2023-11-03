from uuid import UUID

import structlog

from polar.organization.service import organization as organization_service
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    enqueue_job,
    interval,
    task,
)

from ..service.organization import github_organization

log = structlog.get_logger()


@interval(
    hour=13,
    minute=19,
    second=0,
)
async def cron_org_members_schedule(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        orgs = await organization_service.list_installed(session)
        for org in orgs:
            await enqueue_job(
                "github.organization.synchronize_members",
                organization_id=org.id,
            )


@task("github.organization.synchronize_members")
async def organization_refresh_members(
    ctx: JobContext,
    organization_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            org = await github_organization.get(session, organization_id)
            if not org:
                return

            log.info(
                "github.organization.synchronize_members",
                organization_id=organization_id,
            )

            await github_organization.synchronize_members(session, org)


@interval(
    hour=10,
    minute=19,
    second=0,
)
async def cron_org_metadata(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        orgs = await organization_service.list_installed(session)
        for org in orgs:
            await enqueue_job(
                "github.organization.populate_org_metadata",
                organization_id=org.id,
            )


@task("github.organization.populate_org_metadata")
async def populate_org_metadata(
    ctx: JobContext,
    organization_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            org = await github_organization.get(session, organization_id)
            if not org:
                return

            log.info(
                "github.organization.populate_org_metadata",
                organization_id=organization_id,
            )

            await github_organization.populate_org_metadata(session, org)
