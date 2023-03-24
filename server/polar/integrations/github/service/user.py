from typing import Callable, List, Any
import structlog
from pydantic import EmailStr

from polar.enums import Platforms
from polar.kit.extensions.sqlalchemy import sql
from polar.models import User, OAuthAccount
from polar.postgres import AsyncSession
from polar.user.service import UserService, user as user_service
from polar.user.schemas import UserCreate
from polar.organization.service import organization

from .. import client as github
from ..schemas import OAuthAccessToken
from ..types import GithubUser

log = structlog.get_logger()


class GithubUserService(UserService):
    async def get_user_by_github_id(
        self, session: AsyncSession, id: int
    ) -> User | None:
        stmt = (
            sql.select(User)
            .join(OAuthAccount, User.id == OAuthAccount.user_id)
            .where(
                OAuthAccount.oauth_name == Platforms.github.value,
                OAuthAccount.account_id == str(id),
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
            "username": github_user.login,
            "platform": "github",
            "external_id": github_user.id,
            "avatar_url": github_user.avatar_url,
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
        new_user = await user_service.create(
            session,
            create_schema=UserCreate(
                email=EmailStr(github_user.email),
                profile=profile,
                hashed_password="",
                is_active=True,
                is_verified=True,
                is_superuser=False,
            ),
        )
        account = OAuthAccount(
            oauth_name=Platforms.github.value,
            access_token=tokens.access_token,
            expires_at=tokens.expires_at,
            refresh_token=tokens.refresh_token,
            account_id=str(github_user.id),
            account_email=github_user.email,
            user_id=new_user.id,
        )
        session.add(account)
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
        await user.update(
            session,
            autocommit=False,
            profile=profile,
        )
        account = user.get_platform_oauth_account(Platforms.github)
        if not account:
            raise RuntimeError("No github account found for user")

        await account.update(
            session,
            autocommit=False,
            # Update everything except unique references (user_id + account_id)
            access_token=tokens.access_token,
            expires_at=tokens.expires_at,
            refresh_token=tokens.refresh_token,
            account_email=github_user.email,
        )
        await session.commit()
        log.info(
            "github.user.login",
            user_id=user.id,
            github_username=user.profile["username"],
        )
        return user

    async def login_or_signup(
        self, session: AsyncSession, *, tokens: OAuthAccessToken
    ) -> User:
        authenticated = await self.fetch_authenticated_user(
            access_token=tokens.access_token
        )
        existing_user = await self.get_user_by_github_id(session, id=authenticated.id)
        if existing_user:
            user = await self.login(
                session, github_user=authenticated, user=existing_user, tokens=tokens
            )
        else:
            user = await self.signup(session, github_user=authenticated, tokens=tokens)

        # TODO Fix and re-implement sync_github_admin_orgs
        # await self.sync_github_admin_orgs(session, user)
        return user

    async def sync_github_admin_orgs(self, session: AsyncSession, user: User) -> None:
        installations = await self.fetch_user_accessible_installations(session, user)

        user_client = await github.get_user_client(session, user)
        self_github_user = user_client.rest.users.get_authenticated()

        log.info(
            "sync_github_admin_orgs.installations",
            user_id=user.id,
            installation_ids=[i.id for i in installations],
        )

        gh_oauth = user.get_platform_oauth_account(Platforms.github)
        if not gh_oauth:
            log.error("sync_github_admin_orgs.no-platform-oauth-found", user_id=user.id)
            return

        for i in installations:
            if not i.account:
                continue
            if isinstance(i.account, github.rest.Enterprise):
                log.error("sync_github_admin_orgs.github_enterprise_not_supoprted")
                continue

            org = await organization.get_by_platform(
                session, Platforms.github, i.account.id
            )
            if not org:
                log.error("sync_github_admin_orgs.org-not-found", id=i.id)
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
            else:
                try:
                    client = github.get_app_installation_client(i.id)

                    # If installed on github org, check access
                    membership = await client.rest.orgs.async_get_membership_for_user(
                        i.account.login,
                        self_github_user.parsed_data.login,
                    )

                    data = membership.parsed_data
                    if data.role == "admin" and data.state == "active":
                        log.info(
                            "sync_github_admin_orgs.add_admin",
                            org_id=org.id,
                            user_id=user.id,
                        )

                        # Add as admin in Polar (or upgrade existing memeber to admin)
                        await organization.add_user(session, org, user, is_admin=True)
                except Exception as e:
                    log.error(
                        "sync_github_admin_orgs.failed",
                        err=e,
                        org_id=org.id,
                        user_id=user.id,
                    )

    async def fetch_authenticated_user(self, *, access_token: str) -> GithubUser:
        client = github.get_client(access_token)

        # Get authenticated github user
        response = await client.rest.users.async_get_authenticated()
        github.ensure_expected_response(response)
        gh_user = response.parsed_data
        if github.is_set(gh_user, "email"):
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

    async def fetch_user_accessible_installations(
        self, session: AsyncSession, user: User
    ) -> List[github.rest.Installation]:
        """
        Load user accessible installations from GitHub API
        Finds the union between app installations and the users user-to-server token.
        """

        def map_func(
            r: github.Response[github.rest.UserInstallationsGetResponse200],
        ):
            return r.parsed_data.installations

        client = await github.get_user_client(session, user)
        res = []
        async for install in client.paginate(
            client.rest.apps.async_list_installations_for_authenticated_user,
            map_func=map_func,
        ):
            res.append(install)
        return res

    async def fetch_user_accessible_installation_repositories(
        self,
        session: AsyncSession,
        user: User,
        installation_id: int,
    ) -> List[github.rest.Repository]:
        """
        Load user accessible repositories from GitHub API
        Finds the union between user accessible repositories in an installation and the
        users user-to-server-token.
        """
        client = await github.get_user_client(session, user)

        res = []

        def map_func(
            r: github.Response[
                github.rest.UserInstallationsInstallationIdRepositoriesGetResponse200
            ],
        ):
            return r.parsed_data.repositories

        async for repo in client.paginate(
            client.rest.apps.async_list_installation_repos_for_authenticated_user,
            map_func=map_func,
            installation_id=installation_id,
        ):
            res.append(repo)

        return res


github_user = GithubUserService(User)
