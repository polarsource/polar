from typing import Annotated, Self
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from polar.authz.service import Anonymous, Subject
from polar.config import settings
from polar.enums import Platforms
from polar.models import Organization, Repository, User
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session

from .service import AuthService

personal_access_token_scheme = HTTPBearer(
    auto_error=False,
    description="You can generate a **Personal Access Token** from your [settings](https://polar.sh/settings/tokens).",
)


async def get_cookie_token(request: Request) -> str | None:
    return request.cookies.get(settings.AUTH_COOKIE_KEY)


async def current_user_optional(
    cookie_token: str | None = Depends(get_cookie_token),
    personal_access_token: HTTPAuthorizationCredentials
    | None = Depends(personal_access_token_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> User | None:
    if cookie_token is not None:
        return await AuthService.get_user_from_cookie(session, cookie=cookie_token)
    elif personal_access_token is not None:
        return await AuthService.get_user_from_personal_access_token(
            session, token=personal_access_token.credentials
        )
    return None


async def current_user_required(
    user: User | None = Depends(current_user_optional),
) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


class Auth:
    subject: Subject
    user: User | None

    def __init__(
        self,
        *,
        subject: Subject,
        user: User | None = None,
        organization: Organization | None = None,
        repository: Repository | None = None,
    ):
        self.subject = subject
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
    async def current_user(cls, user: User = Depends(current_user_required)) -> Self:
        return cls(subject=user, user=user)

    @classmethod
    async def optional_user(
        cls, user: User | None = Depends(current_user_optional)
    ) -> Self:
        if user:
            return cls(subject=user, user=user)
        else:
            return cls(subject=Anonymous())

    @classmethod
    async def user_with_org_access(
        cls,
        *,
        platform: Platforms,
        org_name: str,
        session: AsyncSession = Depends(get_db_session),
        user: User = Depends(current_user_required),
    ) -> Self:
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
        return cls(subject=user, user=user, organization=organization)

    @classmethod
    async def user_with_org_access_by_id(
        cls,
        *,
        id: UUID,
        session: AsyncSession = Depends(get_db_session),
        user: User = Depends(current_user_required),
    ) -> Self:
        organization = await organization_service.get_by_id_for_user(
            session,
            org_id=id,
            user_id=user.id,
        )
        if not organization:
            raise HTTPException(
                status_code=404, detail="Organization not found for user"
            )
        return cls(subject=user, user=user, organization=organization)

    @classmethod
    async def user_with_org_and_repo_access(
        cls,
        *,
        platform: Platforms,
        org_name: str,
        repo_name: str,
        session: AsyncSession = Depends(get_db_session),
        user: User = Depends(current_user_required),
    ) -> Self:
        org, repo = await organization_service.get_with_repo_for_user(
            session,
            platform=platform,
            org_name=org_name,
            repo_name=repo_name,
            user_id=user.id,
        )
        return cls(subject=user, user=user, organization=org, repository=repo)

    @classmethod
    async def backoffice_user(
        cls,
        *,
        user: User = Depends(current_user_required),
    ) -> Self:
        allowed = ["zegl", "birkjernstrom", "hult", "petterheterjag"]

        if user.username not in allowed:
            raise HTTPException(
                status_code=404,
                detail="Not Found",
            )

        return cls(subject=user, user=user)


class AuthRequired(Auth):
    subject: User
    user: User


UserRequiredAuth = Annotated[AuthRequired, Depends(Auth.current_user)]
