from typing import Any, List

import structlog

from polar.enums import Platforms
from polar.integrations.github.client import GitHub, TokenAuthStrategy
from polar.kit.extensions.sqlalchemy import sql
from polar.models import OAuthAccount, User
from polar.organization.service import organization
from polar.postgres import AsyncSession
from polar.posthog import posthog
from polar.user.service import UserService

from .. import client as github
from ..schemas import OAuthAccessToken

log = structlog.get_logger()


GithubUser = github.rest.PrivateUser | github.rest.PublicUser


class GithubUserService(UserService):
    async def get_user_by_github_id(
        self, session: AsyncSession, id: int
    ) -> User | None:
        stmt = (
            sql.select(User)
            .join(OAuthAccount, User.id == OAuthAccount.user_id)
            .where(
                OAuthAccount.platform == Platforms.github,
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
                OAuthAccount.platform == Platforms.github,
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
        tokens: OAuthAccessToken,
    ) -> User:
        profile = self.generate_profile_json(github_user=github_user)
        new_user = User(
            username=github_user.login,
            email=github_user.email,
            avatar_url=github_user.avatar_url,
            profile=profile,
            oauth_accounts=[
                OAuthAccount(
                    platform=Platforms.github,
                    access_token=tokens.access_token,
                    expires_at=tokens.expires_at,
                    refresh_token=tokens.refresh_token,
                    account_id=str(github_user.id),
                    account_email=github_user.email,
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
        user: User,
        tokens: OAuthAccessToken,
    ) -> User:
        profile = self.generate_profile_json(github_user=github_user)

        if not github_user.email:
            raise Exception("user has no email")

        user.username = github_user.login
        user.email = github_user.email
        user.avatar_url = github_user.avatar_url
        user.profile = profile
        await user.save(session)

        oauth_account: OAuthAccount | None = user.get_platform_oauth_account(
            Platforms.github
        )
        if not oauth_account:
            raise RuntimeError("No github account found for user")

        oauth_account.access_token = tokens.access_token
        oauth_account.expires_at = tokens.expires_at
        oauth_account.refresh_token = tokens.refresh_token
        oauth_account.account_email = github_user.email
        await oauth_account.save(session)

        log.info(
            "github.user.login",
            user_id=user.id,
            username=user.username,
        )
        return user

    async def login_or_signup(
        self, session: AsyncSession, *, tokens: OAuthAccessToken
    ) -> User:
        client = github.get_client(access_token=tokens.access_token)
        authenticated = await self.fetch_authenticated_user(client=client)
        existing_user = await self.get_user_by_github_id(session, id=authenticated.id)
        if existing_user:
            user = await self.login(
                session, github_user=authenticated, user=existing_user, tokens=tokens
            )
            event_name = "User Logged In"
        else:
            user = await self.signup(session, github_user=authenticated, tokens=tokens)
            event_name = "User Signed Up"

        org_count = await self._run_sync_github_admin_orgs(
            session,
            user=user,
            github_user=authenticated,
        )
        posthog.user_event(
            user,
            event_name,
            {
                "$set": {
                    "org_count": org_count,
                },
            },
        )
        return user

    async def sync_github_admin_orgs(
        self, session: AsyncSession, *, user: User
    ) -> None:
        user_client = await github.get_user_client(session, user)
        github_user = await self.fetch_authenticated_user(
            client=user_client, email_required=False
        )
        await self._run_sync_github_admin_orgs(
            session,
            user=user,
            github_user=github_user,
        )

    async def _run_sync_github_admin_orgs(
        self,
        session: AsyncSession,
        *,
        user: User,
        github_user: GithubUser,
    ) -> int:
        org_count = 0

        installations = await self.fetch_user_accessible_installations(session, user)
        log.info(
            "sync_github_admin_orgs.installations",
            user_id=user.id,
            installation_ids=[i.id for i in installations],
        )
        gh_oauth = user.get_platform_oauth_account(Platforms.github)
        if not gh_oauth:
            log.error("sync_github_admin_orgs.no_platform_oauth_found", user_id=user.id)
            return org_count

        for i in installations:
            if not i.account:
                continue

            if isinstance(i.account, github.rest.Enterprise):
                log.error("sync_github_admin_orgs.github_enterprise_not_supported")
                continue

            org = await organization.get_by_platform(
                session, Platforms.github, i.account.id
            )
            if not org:
                log.error("sync_github_admin_orgs.org_not_found", id=i.id)
                continue

            # If installed on personal account, always admin
            if i.account.id == int(gh_oauth.account_id):
                log.info(
                    "sync_github_admin_orgs.add_admin",
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
                        "sync_github_admin_orgs.add_admin",
                        org_id=org.id,
                        user_id=user.id,
                    )

                    # Add as admin in Polar (or upgrade existing member to admin)
                    await organization.add_user(session, org, user, is_admin=True)
                    org_count += 1
            except Exception as e:
                log.error(
                    "sync_github_admin_orgs.failed",
                    err=e,
                    org_id=org.id,
                    user_id=user.id,
                )

        return org_count

    async def fetch_authenticated_user(
        self,
        *,
        client: GitHub[TokenAuthStrategy],
        email_required: bool = True,
    ) -> GithubUser:
        # Get authenticated github user
        response = await client.rest.users.async_get_authenticated()
        github.ensure_expected_response(response)
        gh_user = response.parsed_data
        if not email_required or github.is_set(gh_user, "email"):
            return gh_user

        # No public email. Using our user:email scope permission to fetch
        # all private emails and using the first one which is the primary.
        #
        # TODO: Re-confirm that it is indeed the primary
        email_response = (
            await client.rest.users.async_list_emails_for_authenticated_user()
        )
        github.ensure_expected_response(email_response)
        emails = email_response.parsed_data
        gh_user.email = emails[0].email
        return gh_user

    def map_installations_func(
        self,
        r: github.Response[github.rest.UserInstallationsGetResponse200],
    ) -> list[github.rest.Installation]:
        return r.parsed_data.installations

    async def fetch_user_accessible_installations(
        self, session: AsyncSession, user: User
    ) -> List[github.rest.Installation]:
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
