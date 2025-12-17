from typing import TYPE_CHECKING

import structlog
from httpx_oauth.oauth2 import OAuth2Token

from polar.exceptions import PolarError
from polar.integrations.github.client import GitHub, TokenAuthStrategy
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.user.oauth_service import oauth_account_service
from polar.user.repository import UserRepository
from polar.user.schemas import UserSignupAttribution
from polar.worker import enqueue_job

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


class CannotLinkUnverifiedEmailError(GithubUserServiceError):
    def __init__(self, email: str) -> None:
        message = (
            f"An account already exists on Polar under the email {email}. "
            "We cannot automatically link it to your GitHub account since "
            "this email address is not verified on GitHub. "
            "Either verify your email address on GitHub and try again "
            "or sign in using your email."
        )
        super().__init__(message, 403)


class AccountLinkedToAnotherUserError(GithubUserServiceError):
    def __init__(self) -> None:
        message = (
            "This GitHub account is already linked to another user on Polar. "
            "You may have already created another account "
            "with a different email address."
        )
        super().__init__(message, 403)


class GithubUserService:
    async def get_updated_or_create(
        self,
        session: AsyncSession,
        *,
        token: OAuth2Token,
        signup_attribution: UserSignupAttribution | None = None,
    ) -> tuple[User, bool]:
        client = github.get_client(access_token=token["access_token"])
        authenticated = await self._fetch_authenticated_user(client=client)
        user_repository = UserRepository.from_session(session)
        user = await user_repository.get_by_oauth_account(
            OAuthPlatform.github, str(authenticated.id)
        )

        if user is not None:
            oauth_account = user.get_oauth_account(OAuthPlatform.github)
            assert oauth_account is not None
            oauth_account.access_token = token["access_token"]
            oauth_account.expires_at = token["expires_at"]
            oauth_account.account_username = authenticated.login
            session.add(oauth_account)
            return (user, False)

        email, email_verified = await self.fetch_authenticated_user_primary_email(
            client=client
        )

        oauth_account = OAuthAccount(
            platform=OAuthPlatform.github,
            account_id=str(authenticated.id),
            account_email=email,
            account_username=authenticated.login,
            access_token=token["access_token"],
            expires_at=token["expires_at"],
        )

        user = await user_repository.get_by_email(email)
        if user is not None:
            if email_verified:
                user.oauth_accounts.append(oauth_account)
                session.add(user)
                return (user, False)
            else:
                raise CannotLinkUnverifiedEmailError(email)

        user = User(
            email=email,
            email_verified=email_verified,
            avatar_url=authenticated.avatar_url,
            oauth_accounts=[oauth_account],
            signup_attribution=signup_attribution,
        )

        session.add(user)
        await session.flush()

        enqueue_job("user.on_after_signup", user_id=user.id)

        return (user, True)

    async def link_user(
        self, session: AsyncSession, *, user: User, token: OAuth2Token
    ) -> User:
        client = github.get_client(access_token=token["access_token"])
        github_user = await self._fetch_authenticated_user(client=client)
        email, _ = await self.fetch_authenticated_user_primary_email(client=client)

        account_id = str(github_user.id)

        oauth_account = await oauth_account_service.get_by_platform_and_account_id(
            session, OAuthPlatform.github, account_id
        )
        if oauth_account is not None:
            if oauth_account.user_id != user.id:
                raise AccountLinkedToAnotherUserError()
        else:
            oauth_account = OAuthAccount(
                platform=OAuthPlatform.github,
                account_id=account_id,
                account_email=email,
                user_id=user.id,
            )
            session.add(oauth_account)
            log.info(
                "oauth_account.connect",
                user_id=user.id,
                platform="github",
                account_email=email,
            )

        oauth_account.access_token = token["access_token"]
        oauth_account.expires_at = token["expires_at"]
        oauth_account.account_email = email
        oauth_account.account_username = github_user.login
        session.add(oauth_account)

        user.avatar_url = github_user.avatar_url
        session.add(user)

        return user

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
