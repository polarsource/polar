import functools
from collections.abc import Awaitable, Callable
from typing import ParamSpec, TypeVar
from uuid import UUID

import structlog
from arq import Retry
from githubkit.exception import RateLimitExceeded

from polar.integrations.github import service
from polar.models import ExternalOrganization, Repository
from polar.postgres import AsyncSession

log = structlog.get_logger()


async def get_external_organization_and_repo(
    session: AsyncSession,
    external_organization_id: UUID,
    repository_id: UUID,
) -> tuple[ExternalOrganization, Repository]:
    external_organization = await service.github_organization.get_linked(
        session, external_organization_id
    )
    if not external_organization:
        log.warning(
            "no external organization found or not linked to a Polar organization",
            external_organization_id=external_organization_id,
        )
        raise ValueError(
            "no external organization found or not linked to a Polar organization"
        )

    repository = await service.github_repository.get(session, repository_id)
    if not repository:
        log.warning("no repository found", repository_id=repository_id)
        raise ValueError("no repository found")

    return (external_organization, repository)


Params = ParamSpec("Params")
ReturnValue = TypeVar("ReturnValue")


def github_rate_limit_retry(
    func: Callable[Params, Awaitable[ReturnValue]],
) -> Callable[Params, Awaitable[ReturnValue]]:
    @functools.wraps(func)
    async def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> ReturnValue:
        try:
            return await func(*args, **kwargs)
        except RateLimitExceeded as e:
            raise Retry(e.retry_after)

    return wrapper
