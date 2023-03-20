import uuid
from typing import AsyncGenerator

from fastapi import Depends, HTTPException
from fastapi_users import FastAPIUsers

from polar.models import OAuthAccount, User, Organization, Repository
from polar.exceptions import ResourceNotFound
from polar.user.service import UserDatabase
from polar.postgres import AsyncSession, get_db_session
from polar.enums import Platforms

from polar.organization.service import organization as organization_service

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
        organization = await organization_service.get_for_user(
            session,
            platform=platform,
            org_name=org_name,
            user_id=user.id,
        )
        if not organization:
            raise HTTPException(
                status_code=404, detail="Organization not found for user"
            )
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
        try:
            org, repo = await organization_service.get_with_repo_for_user(
                session,
                platform=platform,
                org_name=org_name,
                repo_name=repo_name,
                user_id=user.id,
            )
            return Auth(user=user, organization=org, repository=repo)
        except ResourceNotFound:
            raise HTTPException(
                status_code=404,
                detail="Organization/repository combination not found for user",
            )
