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


def encode_state(state: dict[str, Any], *, type: OAuthStateType) -> str:
    return jwt.encode(data=state, secret=settings.SECRET, type=type)


def decode_state(state: str, *, type: OAuthStateType) -> dict[str, Any]:
    try:
        return jwt.decode(token=state, secret=settings.SECRET, type=type)
    except jwt.DecodeError as e:
        raise OAuthCallbackError("Invalid state") from e


def set_login_cookie(
    request: Request,
    response: RedirectResponse,
    encoded_state: str,
    *,
    cross_site: bool = False,
) -> None:
    is_localhost = request.url.hostname in {"127.0.0.1", "localhost"}
    secure = False if is_localhost else True
    response.set_cookie(
        settings.SOCIAL_LOGIN_SESSION_COOKIE_KEY,
        value=encoded_state,
        max_age=int(settings.SOCIAL_LOGIN_SESSION_TTL.total_seconds()),
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
        settings.SOCIAL_LOGIN_SESSION_COOKIE_KEY,
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

    session_cookie = request.cookies.get(settings.SOCIAL_LOGIN_SESSION_COOKIE_KEY)
    if session_cookie is None or session_cookie != state:
        raise OAuthCallbackError("Invalid session cookie")

    return decode_state(state, type=type)
