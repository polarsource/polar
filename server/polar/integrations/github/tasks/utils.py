from uuid import UUID

import structlog

from polar.integrations.github import service
from polar.models import Organization, Repository
from polar.postgres import AsyncSession

log = structlog.get_logger()


async def get_organization_and_repo(
    session: AsyncSession,
    organization_id: UUID,
    repository_id: UUID,
) -> tuple[Organization, Repository]:
    organization = await service.github_organization.get(session, organization_id)
    if not organization:
        log.warning("no organization found", organization_id=organization_id)
        raise ValueError("no organization found")

    repository = await service.github_repository.get(session, repository_id)
    if not repository:
        log.warning("no repository found", repository_id=organization_id)
        raise ValueError("no repository found")

    return (organization, repository)
