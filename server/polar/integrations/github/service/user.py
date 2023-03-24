from typing import Callable, List
import structlog
from polar.enums import Platforms
from polar.kit.extensions.sqlalchemy import sql

from polar.models import User
from polar.models.user import OAuthAccount
from polar.postgres import AsyncSession
from polar.user.service import UserService
from polar.organization.service import organization

from .. import client as github

log = structlog.get_logger()


class GithubUserService(UserService):
    async def get_user_by_github_id(
        self, session: AsyncSession, id: int
    ) -> User | None:
        stmt = (
            sql.select(User)
            .join(OAuthAccount, User.id == OAuthAccount.user_id)
            .where(
                OAuthAccount.oauth_name == "github",
                OAuthAccount.account_id == str(id),
            )
        )
        res = await session.execute(stmt)
        return res.scalars().unique().first()

    async def update_profile(
        self, session: AsyncSession, user: User, access_token: str
    ) -> User:
        oauth = user.get_primary_oauth_account()
        if oauth.access_token != access_token:
            log.warning(
                "user.update_profile", error="access_token.mismatch", user_id=user.id
            )
            return user

        client = await github.get_user_client(session, user)
        response = await client.rest.users.async_get_authenticated()
        try:
            github.ensure_expected_response(response)
        except github.UnexpectedStatusCode:
            log.warning(
                "user.update_profile",
                error="github.http.error",
                user_id=user.id,
                status_code=response.status_code,
            )
            return user

        data = response.json()
        user.profile = {
            "username": data["login"],
            "platform": "github",
            "external_id": data["id"],
            "avatar_url": data["avatar_url"],
            "name": data["name"],
            "bio": data["bio"],
            "company": data["company"],
            "blog": data["blog"],
            "location": data["location"],
            "hireable": data["hireable"],
            "twitter": data["twitter_username"],
            "public_repos": data["public_repos"],
            "public_gists": data["public_gists"],
            "followers": data["followers"],
            "following": data["following"],
            "created_at": data["created_at"],
            "updated_at": data["updated_at"],
        }
        session.add(user)
        # TODO: Check success?
        await session.commit()
        log.info(
            "user.update_profile",
            user_id=user.id,
            github_username=user.profile["username"],
        )
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
