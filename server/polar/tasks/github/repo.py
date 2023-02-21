import structlog

from polar import actions
from polar.models import Organization, Repository
from polar.postgres import AsyncSession
from polar.worker import asyncify_task, task

log = structlog.get_logger()


async def get_organization_and_repo(
    session: AsyncSession,
    organization_id: str,
    repository_id: str,
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
@asyncify_task(with_session=True)
async def sync_repository_issues(
    session: AsyncSession,
    organization_id: str,
    organization_name: str,
    repository_id: str,
    repository_name: str,
    per_page: int = 30,
    page: int = 1,
) -> None:
    organization, repository = await get_organization_and_repo(
        session, organization_id, repository_id
    )
    issues = await actions.github_repository.fetch_issues(organization, repository)

    # TODO: Handle pagination via new task
    await actions.github_issue.store_many(
        session,
        organization_name,
        repository_name,
        issues,
        organization_id=organization_id,
        repository_id=repository_id,
    )


@task(name="github.repo.sync")
@asyncify_task(with_session=True)
async def sync_repository(
    session: AsyncSession,
    organization_id: str,
    organization_name: str,
    repository_id: str,
    repository_name: str,
) -> None:
    sync_repository_issues.delay(
        organization_id, organization_name, repository_id, repository_name
    )
