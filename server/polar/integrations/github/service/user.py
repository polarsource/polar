from typing import List, TypedDict
import structlog

from polar.models import User
from polar.postgres import AsyncSession
from polar.user.service import UserService

from .organization import github_organization
from .repository import github_repository

from .. import client as github

log = structlog.get_logger()


class UserAccessableInstallation(TypedDict):
    installation: github.rest.Installation
    repositories: List[github.rest.Repository]


class GithubUserService(UserService):
    async def update_profile(
        self, session: AsyncSession, user: User, access_token: str
    ) -> User:
        oauth = user.get_primary_oauth_account()
        if oauth.access_token != access_token:
            log.warning(
                "user.update_profile", error="access_token.mismatch", user_id=user.id
            )
            return user

        client = github.get_client(oauth.access_token)
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

    async def user_accessable_repos(
        self, session: AsyncSession, user: User
    ) -> List[UserAccessableInstallation]:
        installations = await self.user_accessable_installations(session, user)

        res = []
        for i in installations:
            # repos = await self.user_accessable_installation_repositories(
            #     session, user, i.id
            # )
            # TODOsss
            o: UserAccessableInstallation = {
                "installation": i,
                "repositories": [],
            }
            res.append(o)

        return res

    async def user_accessable_installations(
        self, session: AsyncSession, user: User
    ) -> List[github.rest.Installation]:
        # Use cache
        # TODO:

        # Fetch which installations the user can access
        installations = await self.fetch_user_accessable_installations(session, user)

        # Write to cache
        for i in installations:
            org = await github_organization.ensure_installed(session, i)

            if not org:
                log.error(
                    "failed to ensure installation",
                    installation_id=i.id,
                    login=i.account.login,
                )
                continue

            await github_organization.add_user(session, org, user)

            log.info(
                "ensured installation", installation=i.account.login, user=user.email
            )
            # await UserOrganization.upsert(
            #    session, UserOrganization(user_id=user.id, organization_id=org.id)
            # )

            # install for org
            await github_repository.install_for_organization(session, org, i.id)

            github_repos = await self.fetch_user_accessable_installation_repositories(
                session, user, i.id
            )

            for github_repo in github_repos:
                repo = await github_repository.ensure_installed(
                    session, org, github_repo
                )
                if not repo:
                    continue
                await github_repository.add_user(session, repo, user)
                log.info(
                    "ensured repository",
                    installation=i.account.login,
                    repo=github_repo.name,
                    user=user.email,
                )

            # TODO: remove repos that the user no longer has access to
        # TODO: remove orgs that the user no longer has access to
        # TODO: something is messing up the transactions?

        return []

    async def fetch_user_accessable_installations(
        self, session: AsyncSession, user: User
    ) -> List[github.rest.Installation]:
        """
        Load user accessable installations from GitHub API

        Finds the union between app installations and the users user-to-server token.
        """

        client = await github.get_user_client(session, user)
        res = []
        async for install in client.paginate(
            client.rest.apps.async_list_installations_for_authenticated_user,
            map_func=lambda r: r.parsed_data.installations,
        ):
            res.append(install)
        return res

    async def fetch_user_accessable_installation_repositories(
        self,
        session: AsyncSession,
        user: User,
        installation_id: int,
    ) -> List[github.rest.Repository]:
        """
        Load user accessable repositories from GitHub API

        Finds the union between user accessable repositories in an installation and the
        users user-to-server-token.
        """
        client = await github.get_user_client(session, user)

        res = []

        async for repo in client.paginate(
            client.rest.apps.async_list_installation_repos_for_authenticated_user,
            map_func=lambda r: r.parsed_data.repositories,
            installation_id=installation_id,
        ):
            res.append(repo)

        return res


github_user = GithubUserService(User)
