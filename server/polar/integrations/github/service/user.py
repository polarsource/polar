from typing import TYPE_CHECKING

import structlog

from polar.exceptions import PolarError
from polar.integrations.github.client import GitHub, TokenAuthStrategy

if TYPE_CHECKING:
    from githubkit.versions.latest.models import PrivateUser, PublicUser

from .. import client as github

log = structlog.get_logger()


type GithubUser = "PrivateUser | PublicUser"
type GithubEmail = tuple[str, bool]


class GithubUserServiceError(PolarError): ...


class NoPrimaryEmailError(GithubUserServiceError):
    def __init__(self) -> None:
        super().__init__("GitHub user without primary email set")


class GithubUserService:
    async def fetch_authenticated_user_primary_email(
        self, *, client: GitHub[TokenAuthStrategy]
    ) -> GithubEmail:
        email_response = (
            await client.rest.users.async_list_emails_for_authenticated_user()
        )

        try:
            github.ensure_expected_response(email_response)
        except Exception as e:
            log.error("fetch_authenticated_user_primary_email.failed", err=e)
            raise NoPrimaryEmailError() from e

        emails = email_response.parsed_data

        for email in emails:
            if email.primary:
                return email.email, email.verified

        raise NoPrimaryEmailError()

    async def _fetch_authenticated_user(
        self, *, client: GitHub[TokenAuthStrategy]
    ) -> GithubUser:
        response = await client.rest.users.async_get_authenticated()
        github.ensure_expected_response(response)
        return response.parsed_data


github_user = GithubUserService()
