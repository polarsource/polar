from typing import Any

import structlog

from polar.enums import UserSignupType
from polar.exceptions import PolarError
from polar.integrations.github.client import GitHub, TokenAuthStrategy
from polar.integrations.loops.service import loops as loops_service
from polar.kit.extensions.sqlalchemy import sql
from polar.locker import Locker
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.posthog import posthog
from polar.user.oauth_service import oauth_account_service
from polar.user.service.user import UserService
from polar.worker import enqueue_job

from .. import client as github
from .. import types
from ..schemas import OAuthAccessToken

log = structlog.get_logger()


GithubUser = types.PrivateUser | types.PublicUser

GithubEmail = tuple[str, bool]


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
            "or sign in with a magic link."
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


class GithubUserService(UserService):
    async def get_user_by_github_id(
        self, session: AsyncSession, id: int
    ) -> User | None:
        stmt = (
            sql.select(User)
            .join(OAuthAccount, User.id == OAuthAccount.user_id)
            .where(
                OAuthAccount.platform == OAuthPlatform.github,
                OAuthAccount.account_id == str(id),
            )
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    async def get_user_by_github_username(
        self,
        session: AsyncSession,
        username: str,
    ) -> User | None:
        stmt = (
            sql.select(User)
            .join(OAuthAccount, User.id == OAuthAccount.user_id)
            .where(
                OAuthAccount.platform == OAuthPlatform.github,
                OAuthAccount.account_username == username,
            )
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    def generate_profile_json(
        self,
        *,
        github_user: GithubUser,
    ) -> dict[str, Any]:
        return {
            "platform": "github",
            "name": github_user.name,
            "bio": github_user.bio,
            "company": github_user.company,
            "blog": github_user.blog,
            "location": github_user.location,
            "hireable": github_user.hireable,
            "twitter": github_user.twitter_username,
            "public_repos": github_user.public_repos,
            "public_gists": github_user.public_gists,
            "followers": github_user.followers,
            "following": github_user.following,
            "created_at": github_user.created_at.isoformat(),
            "updated_at": github_user.updated_at.isoformat(),
        }

    async def signup(
        self,
        session: AsyncSession,
        *,
        github_user: GithubUser,
        github_email: GithubEmail,
        tokens: OAuthAccessToken,
    ) -> User:
        email, email_verified = github_email
        new_user = User(
            username=github_user.login,
            email=email,
            email_verified=email_verified,
            avatar_url=github_user.avatar_url,
            oauth_accounts=[
                OAuthAccount(
                    platform=OAuthPlatform.github,
                    access_token=tokens.access_token,
                    expires_at=tokens.expires_at,
                    refresh_token=tokens.refresh_token,
                    refresh_token_expires_at=tokens.refresh_token_expires_at,
                    account_id=str(github_user.id),
                    account_email=email,
                    account_username=github_user.login,
                )
            ],
        )
        session.add(new_user)
        await session.commit()

        log.info("github.user.signup", user_id=new_user.id, username=github_user.login)

        enqueue_job("user.on_after_signup", user_id=user.id)

        return new_user

    async def login(
        self,
        session: AsyncSession,
        *,
        github_user: GithubUser,
        user: User,
        tokens: OAuthAccessToken,
        client: GitHub[TokenAuthStrategy],
    ) -> User:
        # Fetch primary email from github
        # Required to succeed for new users signups. For existing users we'll let it fail.
        github_email: GithubEmail | None = None
        try:
            github_email = await self.fetch_authenticated_user_primary_email(
                client=client
            )
        except NoPrimaryEmailError:
            pass

        user.username = github_user.login
        user.avatar_url = github_user.avatar_url
        session.add(user)

        oauth_account = await oauth_account_service.get_by_platform_and_user_id(
            session, OAuthPlatform.github, user.id
        )
        if oauth_account is None:
            if github_email is None:
                raise NoPrimaryEmailError()

            email, _ = github_email

            oauth_account = OAuthAccount(
                platform=OAuthPlatform.github,
                account_id=str(github_user.id),
                account_email=email,
                account_username=github_user.login,
                user=user,
            )

        # update email if fetch was successful
        if github_email is not None:
            email, _ = github_email
            oauth_account.account_email = email

        oauth_account.access_token = tokens.access_token
        oauth_account.expires_at = tokens.expires_at
        oauth_account.refresh_token = tokens.refresh_token
        oauth_account.refresh_token_expires_at = tokens.refresh_token_expires_at
        oauth_account.account_username = github_user.login
        session.add(oauth_account)

        log.info(
            "github.user.login",
            user_id=user.id,
            username=user.username,
        )
        return user

    async def login_or_signup(
        self,
        session: AsyncSession,
        locker: Locker,
        *,
        tokens: OAuthAccessToken,
        signup_type: UserSignupType | None = None,
    ) -> User:
        client = github.get_client(access_token=tokens.access_token)
        authenticated = await self.fetch_authenticated_user(client=client)

        user, event_name, signup = await self._login_or_signup_create_user(
            session,
            tokens=tokens,
            client=client,
            authenticated=authenticated,
        )

        posthog.user_event(user, "user", event_name, "done")

        if signup:
            await loops_service.user_signup(user, signup_type, gitHubConnected=True)
        else:
            await loops_service.user_update(user, gitHubConnected=True)
        return user

    async def _login_or_signup_create_user(
        self,
        session: AsyncSession,
        *,
        tokens: OAuthAccessToken,
        client: GitHub[TokenAuthStrategy],
        authenticated: GithubUser,
    ) -> tuple[User, str, bool]:
        # Check if we have an existing user with this GitHub account
        existing_user_by_id = await self.get_user_by_github_id(
            session, id=authenticated.id
        )
        if existing_user_by_id:
            user = await self.login(
                session,
                github_user=authenticated,
                user=existing_user_by_id,
                tokens=tokens,
                client=client,
            )
            posthog.user_event(user, "user", "github_oauth_logged_in", "done")

            return (user, "logged_in", False)

        # Fetch user email
        github_email = await self.fetch_authenticated_user_primary_email(client=client)

        # Check if existing user with this email
        email, email_verified = github_email
        existing_user_by_email = await self.get_by_email(session, email)
        if existing_user_by_email:
            # Automatically link if email is verified
            if email_verified:
                user = await self.login(
                    session,
                    github_user=authenticated,
                    user=existing_user_by_email,
                    tokens=tokens,
                    client=client,
                )
                posthog.user_event(user, "user", "github_oauth_logged_in", "done")
                return (user, "logged_in", False)

            else:
                # For security reasons, don't link if the email is not verified
                raise CannotLinkUnverifiedEmailError(email)

        # New user
        user = await self.signup(
            session,
            github_user=authenticated,
            github_email=github_email,
            tokens=tokens,
        )
        posthog.user_event(user, "user", "github_oauth_signed_up", "done")
        return (user, "signed_up", True)

    async def link_existing_user(
        self, session: AsyncSession, *, user: User, tokens: OAuthAccessToken
    ) -> User:
        client = github.get_client(access_token=tokens.access_token)
        github_user = await self.fetch_authenticated_user(client=client)
        email, _ = await self.fetch_authenticated_user_primary_email(client=client)

        account_id = str(github_user.id)

        # Ensure username doesn't already exists
        # TODO: we can remove this when User.username is dropped
        existing_user = await self.get_by_username(session, github_user.login)
        if existing_user is not None and existing_user.id != user.id:
            raise AccountLinkedToAnotherUserError()

        existing_oauth = await oauth_account_service.get_by_platform_and_username(
            session, OAuthPlatform.github, github_user.login
        )
        if existing_oauth is not None and existing_oauth.user_id != user.id:
            raise AccountLinkedToAnotherUserError()

        # Create or update OAuthAccount
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
            )
            user.oauth_accounts.append(oauth_account)

        oauth_account.access_token = tokens.access_token
        oauth_account.expires_at = tokens.expires_at
        oauth_account.refresh_token = tokens.refresh_token
        oauth_account.refresh_token_expires_at = tokens.refresh_token_expires_at
        oauth_account.account_email = email
        oauth_account.account_username = github_user.login
        session.add(oauth_account)

        # Update User profile
        user.username = github_user.login
        user.avatar_url = github_user.avatar_url
        session.add(user)

        posthog.user_event(user, "user", "github_oauth_link_existing_user", "done")

        return user

    async def fetch_authenticated_user(
        self, *, client: GitHub[TokenAuthStrategy]
    ) -> GithubUser:
        response = await client.rest.users.async_get_authenticated()
        github.ensure_expected_response(response)
        return response.parsed_data

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

    def map_installations_func(
        self,
        r: github.Response[types.UserInstallationsGetResponse200],
    ) -> list[types.Installation]:
        return r.parsed_data.installations

    async def fetch_user_accessible_installations(
        self, session: AsyncSession, locker: Locker, user: User
    ) -> list[types.Installation]:
        """
        Load user accessible installations from GitHub API
        Finds the union between app installations and the users user-to-server token.
        """

        client = await github.get_user_client(session, locker, user)
        res = []
        async for install in client.paginate(
            client.rest.apps.async_list_installations_for_authenticated_user,
            map_func=self.map_installations_func,
        ):
            res.append(install)
        return res


github_user = GithubUserService(User)
