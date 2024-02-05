from typing import Any

import structlog

from polar.enums import Platforms, UserSignupType
from polar.exceptions import PolarError, ResourceAlreadyExists
from polar.integrations.github.client import GitHub, TokenAuthStrategy
from polar.integrations.loops.service import loops as loops_service
from polar.kit.extensions.sqlalchemy import sql
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.organization.service import organization
from polar.postgres import AsyncSession
from polar.posthog import posthog
from polar.user.oauth_service import oauth_account_service
from polar.user.service import UserService

from .. import client as github
from .. import types
from ..schemas import OAuthAccessToken

log = structlog.get_logger()


GithubUser = types.PrivateUser | types.PublicUser

GithubEmail = tuple[str, bool]


class GithubUserServiceError(PolarError):
    ...


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
                User.username == username,
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
        profile = self.generate_profile_json(github_user=github_user)
        email, email_verified = github_email
        new_user = User(
            username=github_user.login,
            email=email,
            email_verified=email_verified,
            avatar_url=github_user.avatar_url,
            profile=profile,
            oauth_accounts=[
                OAuthAccount(
                    platform=OAuthPlatform.github,
                    access_token=tokens.access_token,
                    expires_at=tokens.expires_at,
                    refresh_token=tokens.refresh_token,
                    account_id=str(github_user.id),
                    account_email=email,
                    account_username=github_user.login,
                )
            ],
        )
        session.add(new_user)
        await session.commit()
        log.info("github.user.signup", user_id=new_user.id, username=github_user.login)
        return new_user

    async def login(
        self,
        session: AsyncSession,
        *,
        github_user: GithubUser,
        github_email: GithubEmail,
        user: User,
        tokens: OAuthAccessToken,
    ) -> User:
        profile = self.generate_profile_json(github_user=github_user)

        email, _ = github_email

        user.username = github_user.login
        user.avatar_url = github_user.avatar_url
        user.profile = profile
        await user.save(session)

        oauth_account = await oauth_account_service.get_by_platform_and_user_id(
            session, OAuthPlatform.github, user.id
        )
        if oauth_account is None:
            oauth_account = OAuthAccount(
                platform=OAuthPlatform.github,
                account_id=str(github_user.id),
                account_email=email,
                account_username=github_user.login,
                user=user,
            )

        oauth_account.access_token = tokens.access_token
        oauth_account.expires_at = tokens.expires_at
        oauth_account.refresh_token = tokens.refresh_token
        oauth_account.account_email = email
        oauth_account.account_username = github_user.login
        await oauth_account.save(session)

        log.info(
            "github.user.login",
            user_id=user.id,
            username=user.username,
        )
        return user

    async def login_or_signup(
        self,
        session: AsyncSession,
        *,
        tokens: OAuthAccessToken,
        signup_type: UserSignupType | None = None,
    ) -> User:
        client = github.get_client(access_token=tokens.access_token)
        authenticated = await self.fetch_authenticated_user(client=client)
        github_email = await self.fetch_authenticated_user_primary_email(client=client)

        # Check if existing user with this GitHub account
        signup = False
        existing_user_by_id = await self.get_user_by_github_id(
            session, id=authenticated.id
        )
        if existing_user_by_id:
            user = await self.login(
                session,
                github_user=authenticated,
                github_email=github_email,
                user=existing_user_by_id,
                tokens=tokens,
            )
            event_name = "User Logged In"
            posthog.user_event(user, "user", "github_oauth_logged_in", "done")
        else:
            # Check if existing user with this email
            email, email_verified = github_email
            existing_user_by_email = await self.get_by_email(session, email)
            if existing_user_by_email:
                # Automatically link if email is verified
                if email_verified:
                    user = await self.login(
                        session,
                        github_user=authenticated,
                        github_email=github_email,
                        user=existing_user_by_email,
                        tokens=tokens,
                    )
                    event_name = "User Logged In"
                    posthog.user_event(user, "user", "github_oauth_logged_in", "done")
                # For security reasons, don't link if the email is not verified
                else:
                    raise CannotLinkUnverifiedEmailError(email)
            # New user
            else:
                user = await self.signup(
                    session,
                    github_user=authenticated,
                    github_email=github_email,
                    tokens=tokens,
                )
                event_name = "User Signed Up"
                signup = True
                posthog.user_event(user, "user", "github_oauth_signed_up", "done")

        if signup and signup_type == UserSignupType.maintainer:
            try:
                # TODO: Cleaner dependency relationship between org<>user by
                # moving some to the `user_organization` namespace? Local to
                # GitHub integration
                from polar.integrations.github.service.organization import (
                    github_organization as github_organization_service,
                )

                await github_organization_service.create_for_user(session, user=user)
            except ResourceAlreadyExists:
                ...

        org_count = await self._run_sync_github_orgs(
            session,
            user=user,
            github_user=authenticated,
        )
        posthog.user_event_raw(
            user,
            event_name,
            {
                "$set": {
                    "org_count": org_count,
                },
            },
        )
        if signup:
            await loops_service.user_signup(user, signup_type, gitHubConnected=True)
        else:
            await loops_service.user_update(user, gitHubConnected=True)
        return user

    async def link_existing_user(
        self, session: AsyncSession, *, user: User, tokens: OAuthAccessToken
    ) -> User:
        client = github.get_client(access_token=tokens.access_token)
        github_user = await self.fetch_authenticated_user(client=client)
        email, _ = await self.fetch_authenticated_user_primary_email(client=client)

        account_id = str(github_user.id)

        # Ensure username doesn't already exists
        existing_user = await self.get_by_username(session, github_user.login)
        if existing_user is not None:
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
        oauth_account.account_email = email
        oauth_account.account_username = github_user.login
        await oauth_account.save(session)

        # Update User profile
        profile = self.generate_profile_json(github_user=github_user)
        user.username = github_user.login
        user.avatar_url = github_user.avatar_url
        user.profile = profile
        await user.save(session)

        posthog.user_event(user, "user", "github_oauth_link_existing_user", "done")

        return user

    async def sync_github_orgs(self, session: AsyncSession, *, user: User) -> None:
        user_client = await github.get_user_client(session, user)
        github_user = await self.fetch_authenticated_user(client=user_client)
        await self._run_sync_github_orgs(
            session,
            user=user,
            github_user=github_user,
        )

    async def _run_sync_github_orgs(
        self,
        session: AsyncSession,
        *,
        user: User,
        github_user: GithubUser,
    ) -> int:
        org_count = 0

        installations = await self.fetch_user_accessible_installations(session, user)
        log.info(
            "sync_github_orgs.installations",
            user_id=user.id,
            installation_ids=[i.id for i in installations],
        )
        gh_oauth = await oauth_account_service.get_by_platform_and_user_id(
            session, OAuthPlatform.github, user.id
        )
        if not gh_oauth:
            log.error("sync_github_orgs.no_platform_oauth_found", user_id=user.id)
            return org_count

        for i in installations:
            if not i.account:
                continue

            if isinstance(i.account, types.Enterprise):
                log.error("sync_github_orgs.github_enterprise_not_supported")
                continue

            org = await organization.get_by_platform(
                session, Platforms.github, i.account.id
            )
            if not org:
                log.error("sync_github_orgs.org_not_found", id=i.id)
                continue

            # If installed on personal account, always admin
            if i.account.id == int(gh_oauth.account_id):
                log.info(
                    "sync_github_orgs.add_admin",
                    org_id=org.id,
                    user_id=user.id,
                )

                # Add as admin in Polar (or upgrade existing memeber to admin)
                await organization.add_user(session, org, user, is_admin=True)
                org_count += 1
                continue

            # If installed on github org, check access
            try:
                client = github.get_app_installation_client(i.id)
                membership = await client.rest.orgs.async_get_membership_for_user(
                    i.account.login,
                    github_user.login,
                )

                data = membership.parsed_data

                if data.role == "admin" and data.state == "active":
                    log.info(
                        "sync_github_orgs.add_admin",
                        org_id=org.id,
                        user_id=user.id,
                    )

                    # Add as admin in Polar (or upgrade existing member to admin)
                    await organization.add_user(session, org, user, is_admin=True)
                    org_count += 1

                elif data.state == "active":
                    log.info(
                        "sync_github_orgs.add_non_admin",
                        org_id=org.id,
                        user_id=user.id,
                    )

                    # Add as admin in Polar
                    await organization.add_user(session, org, user, is_admin=False)
                    org_count += 1
                else:
                    log.info(
                        "sync_github_orgs.skip_install",
                        org_id=org.id,
                        user_id=user.id,
                    )

            except Exception as e:
                log.error(
                    "sync_github_orgs.failed",
                    err=e,
                    org_id=org.id,
                    user_id=user.id,
                )

        return org_count

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
        github.ensure_expected_response(email_response)
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
        self, session: AsyncSession, user: User
    ) -> list[types.Installation]:
        """
        Load user accessible installations from GitHub API
        Finds the union between app installations and the users user-to-server token.
        """

        client = await github.get_user_client(session, user)
        res = []
        async for install in client.paginate(
            client.rest.apps.async_list_installations_for_authenticated_user,
            map_func=self.map_installations_func,
        ):
            res.append(install)
        return res


github_user = GithubUserService(User)
