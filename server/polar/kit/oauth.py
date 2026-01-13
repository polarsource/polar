import secrets
from typing import Any, Literal

from fastapi import Request
from fastapi.responses import RedirectResponse
from httpx_oauth.oauth2 import OAuth2Token

from polar.config import settings
from polar.exceptions import PolarRedirectionError
from polar.kit import jwt


class OAuthCallbackError(PolarRedirectionError):
    pass


OAuthStateType = Literal["github_oauth", "google_oauth", "apple_oauth"]


def generate_state(state: dict[str, Any], *, type: OAuthStateType) -> tuple[str, str]:
    nonce = secrets.token_urlsafe()
    state_with_nonce = {**state, "nonce": nonce}
    encoded = jwt.encode(data=state_with_nonce, secret=settings.SECRET, type=type)
    return encoded, nonce


def parse_state(state: str, *, type: OAuthStateType) -> dict[str, Any]:
    try:
        return jwt.decode(token=state, secret=settings.SECRET, type=type)
    except jwt.DecodeError as e:
        raise OAuthCallbackError("Invalid state") from e


def set_login_cookie(
    request: Request,
    response: RedirectResponse,
    nonce: str,
    *,
    cross_site: bool = False,
) -> None:
    is_localhost = request.url.hostname in {"127.0.0.1", "localhost"}
    secure = False if is_localhost else True
    response.set_cookie(
        settings.OAUTH_STATE_COOKIE_KEY,
        value=nonce,
        max_age=int(settings.OAUTH_STATE_TTL.total_seconds()),
        path="/",
        secure=secure,
        httponly=True,
        samesite="none" if cross_site else "lax",
    )


def clear_login_cookie(
    request: Request,
    response: RedirectResponse,
    *,
    cross_site: bool = False,
) -> None:
    is_localhost = request.url.hostname in {"127.0.0.1", "localhost"}
    secure = False if is_localhost else True
    response.set_cookie(
        settings.OAUTH_STATE_COOKIE_KEY,
        value="",
        max_age=0,
        path="/",
        secure=secure,
        httponly=True,
        samesite="none" if cross_site else "lax",
    )


def validate_callback(
    request: Request,
    token_data: OAuth2Token,
    state: str | None,
    *,
    type: OAuthStateType,
) -> dict[str, Any]:
    error_description = token_data.get("error_description")
    if error_description:
        raise OAuthCallbackError(error_description)

    if not state:
        raise OAuthCallbackError("No state")

    state_data = parse_state(state, type=type)

    state_nonce = state_data.get("nonce")
    if not state_nonce or not isinstance(state_nonce, str):
        raise OAuthCallbackError("Invalid state: missing nonce")

    cookie_nonce = request.cookies.get(settings.OAUTH_STATE_COOKIE_KEY)
    if cookie_nonce is None:
        raise OAuthCallbackError("Invalid session cookie")

    if not secrets.compare_digest(state_nonce, cookie_nonce):
        raise OAuthCallbackError("Invalid session cookie")

    return state_data
