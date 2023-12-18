from enum import Enum, auto
from typing import Annotated, Self

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing_extensions import deprecated

from polar.authz.service import Anonymous, Scope, ScopedSubject, Subject
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
) -> tuple[ScopedSubject | None, AuthMethod | None]:
    if cookie_token is not None:
        user = await AuthService.get_user_from_cookie(session, cookie=cookie_token)
        if user:
            return (
                ScopedSubject(subject=user, scopes=[Scope.admin]),
                AuthMethod.COOKIE,
            )

    # Authorization header.
    # Can contain both a PAT and a forwarded cookie value (via Next/Vercel)
    if auth_header is not None:
        scoped_subject = await AuthService.get_user_from_auth_header(
            session, token=auth_header.credentials
        )
        if scoped_subject:
            return (
                scoped_subject,
                AuthMethod.PERSONAL_ACCESS_TOKEN,
            )

    return None, None


async def _current_user_required(
    user_auth_method: tuple[ScopedSubject | None, AuthMethod | None] = Depends(
        _current_user_optional
    ),
) -> tuple[ScopedSubject, AuthMethod]:
    user, auth_method = user_auth_method
    if user is None or auth_method is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user, auth_method


class Auth:
    scoped_subject: ScopedSubject
    auth_method: AuthMethod | None

    # Deprecated: prefer to use scoped_subject instead
    user: User | None

    # Deprecated: prefer to use scoped_subject instead
    subject: Subject

    def __init__(
        self,
        *,
        scoped_subject: ScopedSubject,
        auth_method: AuthMethod | None = None,
    ):
        self.scoped_subject = scoped_subject
        self.auth_method = auth_method

        # backwards compatability
        self.subject = scoped_subject.subject

        if isinstance(scoped_subject.subject, User):
            self.user = scoped_subject.subject
        else:
            self.user = None

    ###############################################################################
    # FastAPI dependency methods
    ###############################################################################

    @classmethod
    async def current_user(
        cls,
        user_auth_method: tuple[ScopedSubject, AuthMethod] = Depends(
            _current_user_required
        ),
    ) -> Self:
        scoped_subject, auth_method = user_auth_method
        return cls(scoped_subject=scoped_subject, auth_method=auth_method)

    @classmethod
    async def optional_user(
        cls,
        user_auth_method: tuple[ScopedSubject | None, AuthMethod | None] = Depends(
            _current_user_optional
        ),
    ) -> Self:
        scoped_subject, auth_method = user_auth_method
        if scoped_subject:
            return cls(scoped_subject=scoped_subject, auth_method=auth_method)
        else:
            return cls(scoped_subject=ScopedSubject(subject=Anonymous(), scopes=[]))

    @classmethod
    async def backoffice_user(
        cls,
        *,
        user_auth_method: tuple[ScopedSubject, AuthMethod] = Depends(
            _current_user_required
        ),
    ) -> Self:
        scoped_subject, auth_method = user_auth_method
        allowed = ["zegl", "birkjernstrom", "frankie567", "emilwidlund"]

        if not isinstance(scoped_subject.subject, User):
            raise HTTPException(
                status_code=404,
                detail="Not Found",
            )

        # must have admin scope
        if scoped_subject.scopes != [Scope.admin]:
            raise HTTPException(
                status_code=404,
                detail="Not Found",
            )

        if scoped_subject.subject.username not in allowed:
            raise HTTPException(
                status_code=404,
                detail="Not Found",
            )

        return cls(scoped_subject=scoped_subject, auth_method=auth_method)


class AuthRequired(Auth):
    subject: User
    user: User
    auth_method: AuthMethod


UserRequiredAuth = Annotated[AuthRequired, Depends(Auth.current_user)]
