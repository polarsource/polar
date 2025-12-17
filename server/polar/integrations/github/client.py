from enum import StrEnum
from typing import Any

from githubkit import (
    AppAuthStrategy,
    AppInstallationAuthStrategy,
    GitHub,
    Response,
    TokenAuthStrategy,
)

from polar.config import settings


class UnexpectedStatusCode(Exception): ...


class AuthenticationRequired(UnexpectedStatusCode): ...


class Forbidden(UnexpectedStatusCode): ...


class NotFound(UnexpectedStatusCode): ...


class ValidationFailed(UnexpectedStatusCode): ...


class GitHubApp(StrEnum):
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


def get_client(access_token: str) -> GitHub[TokenAuthStrategy]:
    return GitHub(access_token, http_cache=False)


def get_app_client(
    app: GitHubApp = GitHubApp.repository_benefit,
) -> GitHub[AppAuthStrategy]:
    return GitHub(
        AppAuthStrategy(
            app_id=settings.GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER,
            private_key=settings.GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY,
            client_id=settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_ID,
            client_secret=settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET,
        ),
        http_cache=False,
    )


def get_app_installation_client(
    installation_id: int,
    *,
    app: GitHubApp = GitHubApp.repository_benefit,
) -> GitHub[AppInstallationAuthStrategy]:
    if not installation_id:
        raise Exception("unable to create github client: no installation_id provided")

    return GitHub(
        AppInstallationAuthStrategy(
            app_id=settings.GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER,
            private_key=settings.GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY,
            client_id=settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_ID,
            client_secret=settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET,
            installation_id=installation_id,
        ),
        http_cache=False,
    )


__all__ = [
    "AppInstallationAuthStrategy",
    "GitHub",
    "Response",
    "TokenAuthStrategy",
    "get_app_client",
    "get_app_installation_client",
    "get_client",
]
