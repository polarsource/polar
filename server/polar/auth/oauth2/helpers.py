import typing
from collections.abc import Iterable
from datetime import UTC, datetime

from fastapi import Request, Response
from reauth.factors import FactorBase

from polar.config import settings
from polar.kit.http import is_localhost

from ..exceptions import PolarAuthRedirectionError

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
