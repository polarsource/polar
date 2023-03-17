from datetime import datetime, timedelta
from typing import List, TypedDict
from uuid import UUID
import structlog
from polar.kit.extensions.sqlalchemy import sql

from polar.models import User
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization
from polar.models.user_repository import UserRepository
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
        client = await github.get_user_client(session, user)
        if not client:
            log.warning(
                "user.update_profile", error="no github client found", user_id=user.id
            )
            return user

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

    async def populate_user_accessable_orgs_and_repositories(
        self, session: AsyncSession, user: User
    ) -> None:
        # Fetch which installations the user can access
        installations = await self.fetch_user_accessable_installations(session, user)

        access_to_orgs_ids: List[UUID] = []

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

            access_to_orgs_ids.append(org.id)

            await github_organization.add_user(session, org, user)

            log.info(
                "ensured installation", installation=i.account.login, user=user.email
            )

            # install for org
            await github_repository.install_for_organization(session, org, i.id)

            github_repos = await self.fetch_user_accessable_installation_repositories(
                session, user, i.id
            )

            access_to_repo_ids: List[UUID] = []

            for github_repo in github_repos:
                repo = await github_repository.ensure_installed(
                    session, org, github_repo
                )
                if not repo:
                    continue
                await github_repository.add_user(session, org, repo, user)
                log.info(
                    "ensured repository",
                    installation=i.account.login,
                    repo=github_repo.name,
                    user=user.email,
                )
                access_to_repo_ids.append(repo.id)

            log.info(
                "cleanup access", access_to_repo_ids=access_to_repo_ids, user=user.id
            )

            # Remove access entries for repositories that the user doesn't have access to anymore
            await github_repository.cleanup_repositories_access(
                session, org.id, access_to_repo_ids, user
            )

        # Remove access entries for organizations that the user doesn't have access to anymore
        await github_organization.cleanup_access(session, access_to_orgs_ids, user)

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

    async def user_can_access_org(
        self, session: AsyncSession, user: User, org: Organization
    ) -> bool:

        # Have valid, and recently validated access
        if await self.__user_can_access_org(session, user, org):
            return True

        # Unknown status, refresh from API
        await self.populate_user_accessable_orgs_and_repositories(session, user)

        # TODO: somehow cache false access requests as well

        # Fetch again
        return await self.__user_can_access_org(session, user, org)

    async def __user_can_access_org(
        self, session: AsyncSession, user: User, org: Organization
    ) -> bool:

        stmt = sql.select(UserOrganization).where(
            UserOrganization.user_id == user.id,
            UserOrganization.organization_id == org.id,
        )

        res = await session.execute(stmt)
        user_org = res.scalars().unique().first()
        if not user_org:
            return False
        if not user_org.validated_at:
            return False

        cutoff = datetime.now(user_org.validated_at.tzinfo) - timedelta(days=1)
        if user_org.validated_at < cutoff:
            log.info(
                "stale validated_at, triggering refresh for",
                user=user.id,
                org=org.id,
                validated_at=user_org.validated_at,
                cutoff=cutoff,
            )
            return False
        return True

    async def user_can_access_repo(
        self,
        session: AsyncSession,
        user: User,
        org: Organization,
        repo: Repository,
    ) -> bool:
        # Have valid, and recently validated access
        if await self.__user_can_access_repo(session, user, org, repo):
            return True

        # Unknown status, refresh from API
        await self.populate_user_accessable_orgs_and_repositories(session, user)

        # TODO: somehow cache false access requests as well

        # Fetch again
        return await self.__user_can_access_repo(session, user, org, repo)

    async def __user_can_access_repo(
        self,
        session: AsyncSession,
        user: User,
        org: Organization,
        repo: Repository,
    ) -> bool:

        stmt = sql.select(UserRepository).where(
            UserRepository.user_id == user.id,
            UserRepository.organization_id == org.id,
            UserRepository.repository_id == repo.id,
        )

        res = await session.execute(stmt)
        user_repo = res.scalars().unique().first()
        if not user_repo:
            return False
        if not user_repo.validated_at:
            return False

        cutoff = datetime.now(user_repo.validated_at.tzinfo) - timedelta(days=1)
        if user_repo.validated_at < cutoff:
            log.info(
                "stale validated_at, triggering refresh for", user=user.id, org=org.id
            )
            return False
        return True


github_user = GithubUserService(User)
