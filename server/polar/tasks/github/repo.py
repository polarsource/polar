import structlog

from polar import actions, signals
from polar.ext.sqlalchemy.types import GUID
from polar.models import Organization, Repository
from polar.postgres import AsyncSession
from polar.worker import get_db_session, sync_worker, task

log = structlog.get_logger()


async def get_organization_and_repo(
    session: AsyncSession,
    organization_id: GUID,
    repository_id: GUID,
) -> tuple[Organization, Repository]:
    organization = await actions.github_organization.get(session, organization_id)
    if not organization:
        log.warning("no organization found", organization_id=organization_id)
        raise ValueError("no organization found")

    repository = await actions.github_repository.get(session, repository_id)
    if not repository:
        log.warning("no repository found", repository_id=organization_id)
        raise ValueError("no repository found")

    return (organization, repository)


@task(name="github.repo.sync.issues")
@sync_worker()
async def sync_repository_issues(
    organization_id: GUID,
    repository_id: GUID,
) -> None:
    async with get_db_session() as session:
        organization, repository = await get_organization_and_repo(
            session, organization_id, repository_id
        )
        synced = 0
        async for issue in actions.github_repository.sync_issues(
            session, organization, repository
        ):
            if not issue:
                break

            synced += 1
            log.info(
                "github.repo.sync.issues",
                state="synced",
                created=issue.was_created,
                updated=issue.was_updated,
                issue=issue.id,
                title=issue.title,
            )
            await signals.issue_synced.send_async(
                repository,
                organization=organization,
                issue=issue,
                synced=synced,
            )

        await signals.issue_sync_completed.send_async(
            repository, organization=organization, synced=synced,
        )


@task(name="github.repo.sync.pull_requests")
@sync_worker()
async def sync_repository_pull_requests(
    organization_id: GUID,
    repository_id: GUID,
) -> None:
    async with get_db_session() as session:
        organization, repository = await get_organization_and_repo(
            session, organization_id, repository_id
        )
        async for pull in actions.github_repository.sync_pull_requests(
            session, organization, repository
        ):
            log.info(
                "github.repo.sync.pull_requests",
                state="synced",
                created=pull.was_created,
                updated=pull.was_updated,
                issue=pull.id,
                title=pull.title,
            )


@task(name="github.repo.sync")
@sync_worker()
async def sync_repository(
    organization_id: GUID,
    repository_id: GUID,
) -> None:
    # TODO: A bit silly to call a task scheduling... tasks.
    # Should the invocation of this function skip .delay?
    sync_repository_issues.delay(organization_id, repository_id)
    sync_repository_pull_requests.delay(organization_id, repository_id)
