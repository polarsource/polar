import uuid
from typing import AsyncGenerator

from fastapi import Depends, HTTPException
from fastapi_users import FastAPIUsers
import structlog

from polar.models import OAuthAccount, User, Organization, Repository
from polar.user.service import UserDatabase
from polar.postgres import AsyncSession, get_db_session
from polar.enums import Platforms

from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service
from polar.integrations.github.service.user import github_user

from .session import UserManager, auth_backend


async def get_user_db(
    session: AsyncSession = Depends(get_db_session),
) -> AsyncGenerator[UserDatabase, None]:
    yield UserDatabase(session, User, OAuthAccount)


async def get_user_manager(
    user_db: UserDatabase = Depends(get_user_db),
) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db)


fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)

log = structlog.get_logger()


class Auth:
    def __init__(
        self,
        *,
        user: User,
        organization: Organization | None = None,
        repository: Repository | None = None,
    ):
        self.user = user
        self._organization = organization
        self._repository = repository

    @property
    def organization(self) -> Organization:
        if self._organization:
            return self._organization

        raise AttributeError(
            "No organization set. Use Auth.current_user_with_org_access()."
        )

    @property
    def repository(self) -> Repository:
        if self._repository:
            return self._repository

        raise AttributeError(
            "No repository set. Use Auth.current_user_with_org_and_repo_access()."
        )

    ###############################################################################
    # FastAPI dependency methods
    ###############################################################################

    @classmethod
    async def current_user(cls, user: User = Depends(current_active_user)) -> "Auth":
        return Auth(user=user)

    @classmethod
    async def user_with_org_access(
        cls,
        *,
        platform: Platforms,
        org_name: str,
        session: AsyncSession = Depends(get_db_session),
        user: User = Depends(current_active_user),
    ) -> "Auth":
        organization = await organization_service.get_by_name(
            session,
            platform=platform,
            name=org_name,
        )
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        if not await github_user.user_can_access_org(session, user, organization):
            log.warn("permission-denied.org", user=user.id, org=organization.id)
            raise HTTPException(status_code=404, detail="Organization not found")

        return Auth(user=user, organization=organization)

    @classmethod
    async def user_with_org_and_repo_access(
        cls,
        *,
        platform: Platforms,
        org_name: str,
        repo_name: str,
        session: AsyncSession = Depends(get_db_session),
        user: User = Depends(current_active_user),
    ) -> "Auth":
        organization = await organization_service.get_by_name(
            session,
            platform=platform,
            name=org_name,
        )
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")

        repository = await repository_service.get_by_organization_and_name(
            session, organization_id=organization.id, name=repo_name
        )
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        if not await github_user.user_can_access_repo(
            session, user, organization, repository
        ):
            log.warn(
                "permission-denied.repo",
                user=user.id,
                org=organization.id,
                repo=repository.id,
            )
            raise HTTPException(status_code=404, detail="Repository not found")

        return Auth(user=user, organization=organization, repository=repository)
