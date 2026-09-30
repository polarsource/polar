import typing
from collections.abc import Iterable
from datetime import UTC, datetime
from urllib.parse import urlencode

from fastapi import Request, Response
from reauth.factors import FactorBase

from polar.config import settings
from polar.kit.http import is_localhost
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession

from .exceptions import PolarAuthRedirectionError

OIDC_ERROR_MESSAGE = "An authentication error occurred. Please try again."


def set_state_cookie(
    request: Request, response: Response, state: str, expires_at: int
) -> None:
    expires_datetime = datetime.fromtimestamp(expires_at, tz=UTC)
    response.set_cookie(
        settings.OAUTH2_SESSION_STATE_COOKIE_KEY,
        state,
        path="/",
        httponly=True,
        secure=not is_localhost(request),
        samesite="lax",
        expires=expires_datetime,
    )


def check_factor(
    factor: FactorBase[typing.Any],
    available_factors: Iterable[FactorBase[typing.Any]],
) -> None:
    for available_factor in available_factors:
        if available_factor.identifier == factor.identifier:
            return
    raise PolarAuthRedirectionError("Factor not available for this session")


async def get_sso_redirect_url(
    session: AsyncSession, email: str, context: dict[str, typing.Any] | None
) -> str | None:
    context = context or {}
    if context.get("sso_discovery") is False:
        return None
    _, domain = email.rsplit("@", 1)
    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_sso_enforced_by_domain(domain)
    if organization is None:
        return None
    path = f"/auth/sso/{organization.slug}"
    return_to = context.get("return_to")
    if return_to is not None:
        path = f"{path}?{urlencode({'return_to': return_to})}"
    return settings.generate_frontend_url(path)
