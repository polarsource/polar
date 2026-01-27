import json
import secrets
from typing import Any, Literal

from fastapi import Request
from fastapi.responses import RedirectResponse
from httpx_oauth.oauth2 import OAuth2Token

from polar.config import settings
from polar.exceptions import PolarRedirectionError
from polar.redis import Redis


class OAuthCallbackError(PolarRedirectionError):
    pass


OAuthStateType = Literal["github", "google", "apple"]


def get_oauth_state_key(nonce: str, type: OAuthStateType) -> str:
    return f"oauth_state:{type}:{nonce}"


async def store_oauth_state(
    redis: Redis, nonce: str, state_data: dict[str, Any], type: OAuthStateType
) -> None:
    """Store OAuth state in Redis using nonce as key"""
    key = get_oauth_state_key(nonce, type)
    await redis.setex(
        key, int(settings.OAUTH_STATE_TTL.total_seconds()), json.dumps(state_data)
    )


async def retrieve_oauth_state(
    redis: Redis, nonce: str, type: OAuthStateType
) -> dict[str, Any]:
    """Retrieve OAuth state from Redis using nonce as key"""
    key = get_oauth_state_key(nonce, type)
    state_json = await redis.get(key)
    if not state_json:
        raise OAuthCallbackError("Invalid state")
    return json.loads(state_json)


async def delete_oauth_state(redis: Redis, nonce: str, type: OAuthStateType) -> None:
    """Delete OAuth state from Redis"""
    key = get_oauth_state_key(nonce, type)
    await redis.delete(key)


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


async def create_authorization_response(
    request: Request,
    redis: Redis,
    state: dict[str, Any],
    callback_route: str,
    oauth_client: Any,
    scopes: list[str],
    *,
    type: OAuthStateType,
) -> RedirectResponse:
    """Create OAuth authorization response with Redis-backed state storage"""
    # Generate nonce and store state in Redis
    nonce = secrets.token_urlsafe()
    state_with_nonce = {**state, "nonce": nonce}
    await store_oauth_state(redis, nonce, state_with_nonce, type=type)

    redirect_uri = str(request.url_for(callback_route))
    authorization_url = await oauth_client.get_authorization_url(
        redirect_uri=redirect_uri,
        state=nonce,  # Use nonce as state parameter
        scope=scopes,
    )
    response = RedirectResponse(authorization_url, 303)
    set_login_cookie(request, response, nonce)
    return response


async def validate_callback(
    request: Request,
    redis: Redis,
    token_data: OAuth2Token,
    state: str | None,
    *,
    type: OAuthStateType,
) -> dict[str, Any]:
    """Validate OAuth callback using Redis-backed state"""
    error_description = token_data.get("error_description")
    if error_description:
        raise OAuthCallbackError(error_description)

    if not state:
        raise OAuthCallbackError("No state")

    cookie_nonce = request.cookies.get(settings.OAUTH_STATE_COOKIE_KEY)
    if cookie_nonce is None:
        raise OAuthCallbackError("Invalid session cookie")

    if not secrets.compare_digest(state, cookie_nonce):
        raise OAuthCallbackError("Invalid session cookie")

    state_data = await retrieve_oauth_state(redis, state, type=type)

    await delete_oauth_state(redis, state, type=type)

    return state_data
