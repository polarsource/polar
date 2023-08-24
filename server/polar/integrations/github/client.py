import time
from typing import Any, Union

import structlog
from fastapi.encoders import jsonable_encoder
from githubkit import (
    AppAuthStrategy,
    AppInstallationAuthStrategy,
    GitHub,
    Response,
    TokenAuthStrategy,
    rest,
    utils,
    webhooks,
)
from pydantic import Field

from polar.config import settings
from polar.enums import Platforms
from polar.integrations.github.cache import RedisCache
from polar.models.user import User
from polar.postgres import AsyncSession

log = structlog.get_logger()


class UnexpectedStatusCode(Exception):
    ...


class AuthenticationRequired(UnexpectedStatusCode):
    ...


class Forbidden(UnexpectedStatusCode):
    ...


class NotFound(UnexpectedStatusCode):
    ...


class ValidationFailed(UnexpectedStatusCode):
    ...


HTTP_EXCEPTIONS = {
    401: AuthenticationRequired,
    403: Forbidden,
    404: NotFound,
    422: ValidationFailed,
}

###############################################################################
# GITHUBKIT WORKAROUNDS
# TODO: Investigate improvement from githubkit - this is not ergonomic or pretty..
###############################################################################


def is_set(obj: object, name: str) -> bool:
    attr = getattr(obj, name, None)
    if attr is None:
        return False
    return not isinstance(attr, utils.Unset)


def jsonify(obj: Any) -> list[dict[str, Any]] | dict[str, Any] | None:
    if not obj:
        return None

    if isinstance(obj, list):
        return [jsonable_encoder(utils.exclude_unset(o.dict())) for o in obj]
    return jsonable_encoder(utils.exclude_unset(obj.dict()))


def attr(obj: object, attr: str) -> Any:
    if is_set(obj, attr):
        return getattr(obj, attr)
    return None


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


class RefreshAccessToken(rest.GitHubRestModel):
    access_token: str = Field(default=...)  # The new access token
    expires_in: int = Field(
        default=...
    )  # The number of seconds until access_token expires (will always be 28800)
    refresh_token: Union[str, None] = Field(
        default=...
    )  # A new refres token (is only set if the app is using expiring refresh tokens)
    refresh_token_expires_in: Union[int, None] = Field(default=...)
    scope: str = Field(default=...)  # Always an empty string
    token_type: str = Field(default=...)  # Always "bearer"


async def get_user_client(
    session: AsyncSession, user: User
) -> GitHub[TokenAuthStrategy]:
    oauth = user.get_platform_oauth_account(Platforms.github)
    if not oauth:
        raise Exception("no github oauth account found")

    # if token expires within 30 minutes, refresh it
    if (
        oauth.expires_at
        and oauth.refresh_token
        and oauth.expires_at <= (time.time() + 60 * 30)
    ):
        refresh = await GitHub().arequest(
            method="POST",
            url="https://github.com/login/oauth/access_token",
            params={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "refresh_token": oauth.refresh_token,
                "grant_type": "refresh_token",
            },
            headers={"Accept": "application/json"},
            response_model=RefreshAccessToken,
        )

        if refresh:
            r = refresh.parsed_data
            # update
            oauth.access_token = r.access_token
            oauth.expires_at = int(time.time()) + r.expires_in
            if r.refresh_token:
                oauth.refresh_token = r.refresh_token

            log.info("github.auth.refresh.succeeded", user=user.id)
            await oauth.save(session)
        else:
            log.error("github.auth.refresh.failed", user=user.id)

    return get_client(oauth.access_token)


def get_client(access_token: str) -> GitHub[TokenAuthStrategy]:
    return GitHub(access_token)


def get_polar_client() -> GitHub[TokenAuthStrategy]:
    """Instead of making anonymous requests, use the polar user's access token,
    so we're at least allowed 5000 reqs/s
    """
    if not settings.GITHUB_POLAR_USER_ACCESS_TOKEN:
        raise Exception("GITHUB_POLAR_USER_ACCESS_TOKEN is not configured")

    return get_client(settings.GITHUB_POLAR_USER_ACCESS_TOKEN)


def get_app_client() -> GitHub[AppAuthStrategy]:
    return GitHub(
        AppAuthStrategy(
            app_id=settings.GITHUB_APP_IDENTIFIER,
            private_key=settings.GITHUB_APP_PRIVATE_KEY,
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
            cache=RedisCache(),
        )
    )


def get_app_installation_client(
    installation_id: int,
) -> GitHub[AppInstallationAuthStrategy]:
    if not installation_id:
        raise Exception("unable to create github client: no installation_id provided")

    # Using the RedisCache() below to cache generated JWTs
    # This improves ETag/If-None-Match cache hits over the default in-memory cache, as
    # they can be reused across restarts of the python process and by multiple workers.
    return GitHub(
        AppInstallationAuthStrategy(
            app_id=settings.GITHUB_APP_IDENTIFIER,
            private_key=settings.GITHUB_APP_PRIVATE_KEY,
            installation_id=installation_id,
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
            cache=RedisCache(),
        )
    )


__all__ = [
    "get_client",
    "get_app_client",
    "get_app_installation_client",
    "get_user_client",
    "webhooks",
    "rest",
    "GitHub",
    "AppInstallationAuthStrategy",
    "TokenAuthStrategy",
    "utils",
    "Response",
]
