from enum import Enum, auto
from typing import Annotated, Self

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from polar.authz.service import Anonymous, Subject
from polar.config import settings
from polar.models import User
from polar.postgres import AsyncSession, get_db_session

from .service import AuthService


class AuthMethod(Enum):
    COOKIE = auto()
    PERSONAL_ACCESS_TOKEN = auto()


auth_header_scheme = HTTPBearer(
    auto_error=False,
    description="You can generate a **Personal Access Token** from your [settings](https://polar.sh/settings).",
)


async def _get_cookie_token(request: Request) -> str | None:
    return request.cookies.get(settings.AUTH_COOKIE_KEY)


async def _current_user_optional(
    cookie_token: str | None = Depends(_get_cookie_token),
    auth_header: HTTPAuthorizationCredentials | None = Depends(auth_header_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> tuple[User | None, AuthMethod | None]:
    if cookie_token is not None:
        return (
            await AuthService.get_user_from_cookie(session, cookie=cookie_token),
            AuthMethod.COOKIE,
        )

    # Authorization header.
    # Can contain both a PAT and a forwarded cookie value (via Next/Vercel)
    if auth_header is not None:
        return (
            await AuthService.get_user_from_auth_header(
                session, token=auth_header.credentials
            ),
            AuthMethod.PERSONAL_ACCESS_TOKEN,
        )

    return None, None


async def _current_user_required(
    user_auth_method: tuple[User | None, AuthMethod | None] = Depends(
        _current_user_optional
    ),
) -> tuple[User, AuthMethod]:
    user, auth_method = user_auth_method
    if user is None or auth_method is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user, auth_method


class Auth:
    subject: Subject
    user: User | None
    auth_method: AuthMethod | None

    def __init__(
        self,
        *,
        subject: Subject,
        user: User | None = None,
        auth_method: AuthMethod | None = None,
    ):
        self.subject = subject
        self.user = user
        self.auth_method = auth_method

    ###############################################################################
    # FastAPI dependency methods
    ###############################################################################

    @classmethod
    async def current_user(
        cls, user_auth_method: tuple[User, AuthMethod] = Depends(_current_user_required)
    ) -> Self:
        user, auth_method = user_auth_method
        return cls(subject=user, user=user, auth_method=auth_method)

    @classmethod
    async def optional_user(
        cls,
        user_auth_method: tuple[User | None, AuthMethod | None] = Depends(
            _current_user_optional
        ),
    ) -> Self:
        user, auth_method = user_auth_method
        if user:
            return cls(subject=user, user=user, auth_method=auth_method)
        else:
            return cls(subject=Anonymous())

    @classmethod
    async def backoffice_user(
        cls,
        *,
        user_auth_method: tuple[User, AuthMethod] = Depends(_current_user_required),
    ) -> Self:
        user, auth_method = user_auth_method
        allowed = ["zegl", "birkjernstrom", "frankie567", "emilwidlund"]

        if user.username not in allowed:
            raise HTTPException(
                status_code=404,
                detail="Not Found",
            )

        return cls(subject=user, user=user, auth_method=auth_method)


class AuthRequired(Auth):
    subject: User
    user: User
    auth_method: AuthMethod


UserRequiredAuth = Annotated[AuthRequired, Depends(Auth.current_user)]
