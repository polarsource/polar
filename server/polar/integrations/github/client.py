import time
from enum import StrEnum
from typing import Any

import httpx
import structlog
from githubkit import (
    AppAuthStrategy,
    AppInstallationAuthStrategy,
    GitHub,
    Response,
    TokenAuthStrategy,
    utils,
    webhooks,
)
from githubkit.typing import Missing
from githubkit.utils import UNSET, Unset
from pydantic import BaseModel, Field

from polar.config import settings
from polar.integrations.github.cache import RedisCache
from polar.locker import Locker
from polar.models.user import OAuthAccount, OAuthPlatform, User
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.user.oauth_service import oauth_account_service

from .types import AppPermissionsType

log = structlog.get_logger()


class UnexpectedStatusCode(Exception): ...


class AuthenticationRequired(UnexpectedStatusCode): ...


class Forbidden(UnexpectedStatusCode): ...


class NotFound(UnexpectedStatusCode): ...


class ValidationFailed(UnexpectedStatusCode): ...


class GitHubApp(StrEnum):
    polar = "polar"
    repository_benefit = "repository_benefit"


HTTP_EXCEPTIONS = {
    401: AuthenticationRequired,
    403: Forbidden,
    404: NotFound,
    422: ValidationFailed,
}

###############################################################################
# GITHUB API HELPERS
###############################################################################


def ensure_expected_response(
    response: Response[Any], accepted: set[int] = {200, 304}
) -> bool:
    status_code = response.status_code
    if status_code in accepted:
        return True

    http_exception = HTTP_EXCEPTIONS.get(status_code, UnexpectedStatusCode)
    raise http_exception()


###############################################################################
# GITHUB API CLIENTS
###############################################################################


class RefreshAccessToken(BaseModel):
    access_token: str = Field(default=...)
    # The number of seconds until access_token expires (will always be 28800)
    expires_in: int = Field(default=...)
    # A new refresh token (is only set if the app is using expiring refresh tokens)
    refresh_token: str | None = Field(default=...)
    # The value will always be 15897600 (6 months) unless token expiration is disabled
    refresh_token_expires_in: int | None = Field(default=...)
    # Always an empty string
    scope: str = Field(default=...)
    # Always "bearer"
    token_type: str = Field(default=...)


async def get_user_client(
    session: AsyncSession, locker: Locker, user: User
) -> GitHub[TokenAuthStrategy]:
    oauth = await oauth_account_service.get_by_platform_and_user_id(
        session, OAuthPlatform.github, user.id
    )
    if not oauth:
        raise Exception("no github oauth account found")

    return await get_refreshed_oauth_client(session, locker, oauth)


async def refresh_oauth_account(
    session: AsyncSession, locker: Locker, oauth: OAuthAccount
) -> OAuthAccount:
    if oauth.platform != OAuthPlatform.github:
        raise Exception("unexpected platform")

    if not oauth.should_refresh_access_token():
        return oauth

    async with locker.lock(
        f"oauth_refresh:{oauth.id}",
        timeout=10.0,
        blocking_timeout=10.0,
    ):
        # first, reload from DB, a concurrent process might have already refreshed this token
        # (and used the refresh token).
        oauth_db = await oauth_account_service.get(session, oauth.id)

        if not oauth_db:
            raise Exception("oauth account not found")

        # token is already refreshed
        if not oauth_db.should_refresh_access_token():
            return oauth_db

        # refresh token
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                "https://github.com/login/oauth/access_token",
                params={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "refresh_token": oauth.refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={"Accept": "application/json"},
            )
            if response.status_code != 200:
                log.error(
                    "github.auth.refresh.error",
                    user_id=oauth_db.user_id,
                    oauth_id=oauth_db.id,
                    http_code=response.status_code,
                )
                return oauth_db

            data = response.json()
            # GitHub returns 200 in case of errors, but with an error payload
            error = data.get("error", None)
            if error:
                log.error(
                    "github.auth.refresh.error",
                    user_id=oauth_db.user_id,
                    oauth_id=oauth_db.id,
                    http_code=response.status_code,
                    error=error,
                    error_description=data.get("error_description", None),
                )
                return oauth_db

            refreshed = RefreshAccessToken.model_validate(data)

            # update
            epoch_now = int(time.time())
            oauth_db.access_token = refreshed.access_token
            oauth_db.expires_at = epoch_now + refreshed.expires_in
            if refreshed.refresh_token:
                oauth_db.refresh_token = refreshed.refresh_token

            if refreshed.refresh_token_expires_in:
                oauth_db.refresh_token_expires_at = (
                    epoch_now + refreshed.refresh_token_expires_in
                )

            log.info(
                "github.auth.refresh.succeeded",
                user_id=oauth.user_id,
                platform=oauth.platform,
            )
            session.add(oauth_db)
            await session.flush()
            return oauth_db


async def get_refreshed_oauth_client(
    session: AsyncSession, locker: Locker, oauth: OAuthAccount
) -> GitHub[TokenAuthStrategy]:
    refreshed_oauth = await refresh_oauth_account(session, locker, oauth)
    return get_client(refreshed_oauth.access_token)


def get_client(access_token: str) -> GitHub[TokenAuthStrategy]:
    return GitHub(access_token)


def get_polar_client() -> GitHub[TokenAuthStrategy]:
    """Instead of making anonymous requests, use the polar user's access token,
    so we're at least allowed 5000 reqs/s
    """
    if not settings.GITHUB_POLAR_USER_ACCESS_TOKEN:
        raise Exception("GITHUB_POLAR_USER_ACCESS_TOKEN is not configured")

    return get_client(settings.GITHUB_POLAR_USER_ACCESS_TOKEN)


def get_app_client(
    redis: Redis, app: GitHubApp = GitHubApp.polar
) -> GitHub[AppAuthStrategy]:
    if app == GitHubApp.polar:
        return GitHub(
            AppAuthStrategy(
                app_id=settings.GITHUB_APP_IDENTIFIER,
                private_key=settings.GITHUB_APP_PRIVATE_KEY,
                client_id=settings.GITHUB_CLIENT_ID,
                client_secret=settings.GITHUB_CLIENT_SECRET,
                cache=RedisCache(app, redis),
            )
        )
    elif app == GitHubApp.repository_benefit:
        return GitHub(
            AppAuthStrategy(
                app_id=settings.GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER,
                private_key=settings.GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY,
                client_id=settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_ID,
                client_secret=settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET,
                cache=RedisCache(app, redis),
            )
        )


def get_app_installation_client(
    installation_id: int,
    *,
    redis: Redis,
    permissions: AppPermissionsType | Unset = UNSET,
    app: GitHubApp = GitHubApp.polar,
) -> GitHub[AppInstallationAuthStrategy]:
    if not installation_id:
        raise Exception("unable to create github client: no installation_id provided")

    # Using the RedisCache() below to cache generated JWTs
    # This improves ETag/If-None-Match cache hits over the default in-memory cache, as
    # they can be reused across restarts of the python process and by multiple workers.

    if app == GitHubApp.polar:
        return GitHub(
            AppInstallationAuthStrategy(
                app_id=settings.GITHUB_APP_IDENTIFIER,
                private_key=settings.GITHUB_APP_PRIVATE_KEY,
                client_id=settings.GITHUB_CLIENT_ID,
                client_secret=settings.GITHUB_CLIENT_SECRET,
                installation_id=installation_id,
                permissions=permissions,
                cache=RedisCache(app, redis),
            )
        )
    elif app == GitHubApp.repository_benefit:
        return GitHub(
            AppInstallationAuthStrategy(
                app_id=settings.GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER,
                private_key=settings.GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY,
                client_id=settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_ID,
                client_secret=settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET,
                installation_id=installation_id,
                permissions=permissions,
                cache=RedisCache(app, redis),
            )
        )


__all__ = [
    "get_client",
    "get_app_client",
    "get_app_installation_client",
    "get_user_client",
    "GitHub",
    "Missing",
    "AppInstallationAuthStrategy",
    "TokenAuthStrategy",
    "utils",
    "Response",
    "webhooks",
]
