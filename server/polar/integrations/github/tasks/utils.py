import functools
from collections.abc import Awaitable, Callable
from typing import ParamSpec, TypeVar
from uuid import UUID

import structlog
from arq import Retry
from githubkit.exception import RateLimitExceeded

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
