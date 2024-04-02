import warnings
from enum import Enum, auto
from typing import Annotated, Self

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from polar.authz.scope import Scope
from polar.authz.service import Anonymous, ScopedSubject, Subject
from polar.config import settings
from polar.exceptions import Unauthorized
from polar.models import OAuth2Token, User
from polar.oauth2.dependencies import get_optional_token
from polar.postgres import AsyncSession, get_db_session

from .service import AuthService


class AuthMethod(Enum):
    COOKIE = auto()
    PERSONAL_ACCESS_TOKEN = auto()
    OAUTH2_ACCESS_TOKEN = auto()


auth_header_scheme = HTTPBearer(
    auto_error=False,
    description="You can generate a **Personal Access Token** from your [settings](https://polar.sh/settings).",
)


async def _get_cookie_token(request: Request) -> str | None:
    return request.cookies.get(settings.AUTH_COOKIE_KEY)


async def _current_user_optional(
    cookie_token: str | None = Depends(_get_cookie_token),
    oauth2_token: OAuth2Token | None = Depends(get_optional_token),
    auth_header: HTTPAuthorizationCredentials | None = Depends(auth_header_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> tuple[ScopedSubject | None, AuthMethod | None]:
    if cookie_token is not None:
        user = await AuthService.get_user_from_cookie(session, cookie=cookie_token)
        if user:
            return (
                ScopedSubject(subject=user, scopes=[Scope.web_default]),
                AuthMethod.COOKIE,
            )

    if oauth2_token:
        return (
            ScopedSubject(subject=oauth2_token.user, scopes=oauth2_token.get_scopes()),
            AuthMethod.OAUTH2_ACCESS_TOKEN,
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

    def __init__(
        self,
        *,
        scoped_subject: ScopedSubject,
        auth_method: AuthMethod | None,
    ):
        self.scoped_subject = scoped_subject
        self.auth_method = auth_method

    @property
    def user(self) -> User | None:
        warnings.warn("Use `scoped_subject` instead of `user`", DeprecationWarning)
        return (
            self.scoped_subject.subject
            if isinstance(self.scoped_subject.subject, User)
            else None
        )

    @property
    def subject(self) -> Subject:
        warnings.warn("Use `scoped_subject` instead of `subject`", DeprecationWarning)
        return self.scoped_subject.subject

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

        # This authentication mechanism is not aware of scopes. Require the web_default scope to auth as user.
        if Scope.web_default not in scoped_subject.scopes:
            raise Unauthorized("This endpoint does not support scoped auth tokens")

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
            # This authentication mechanism is not aware of scopes. Require the admin scope to auth as user.
            if Scope.web_default not in scoped_subject.scopes:
                raise Unauthorized("This endpoint does not support scoped auth tokens")

            return cls(scoped_subject=scoped_subject, auth_method=auth_method)
        else:
            return cls(
                scoped_subject=ScopedSubject(subject=Anonymous(), scopes=[]),
                auth_method=None,
            )

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
        if Scope.web_default not in scoped_subject.scopes:
            raise Unauthorized("This endpoint does not support scoped auth tokens")

        username = scoped_subject.subject.github_username
        if not username or username not in allowed:
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


class AuthenticatedWithScope:
    def __init__(
        self,
        *,
        required_scopes: list[Scope] | None = None,
        fallback_to_anonymous: bool = False,
        allow_anonymous: bool = False,
    ):
        self.required_scopes = required_scopes
        self.fallback_to_anonymous = fallback_to_anonymous
        self.allow_anonymous = allow_anonymous

    def __call__(
        self,
        user_auth_method: tuple[ScopedSubject | None, AuthMethod | None] = Depends(
            _current_user_optional
        ),
    ) -> Auth:
        scoped_subject, auth_method = user_auth_method

        # No valid authentication method
        if not scoped_subject:
            if self.allow_anonymous:
                return Auth(
                    scoped_subject=ScopedSubject(subject=Anonymous(), scopes=[]),
                    auth_method=None,
                )
            else:
                raise HTTPException(status_code=401, detail="Not authenticated")

        if self.required_scopes:
            filtered = [s for s in scoped_subject.scopes if s in self.required_scopes]

            # Have at least one of the required scopes. Allow this request.
            if len(filtered) > 0 and len(self.required_scopes) > 0:
                return Auth(
                    scoped_subject=scoped_subject,
                    auth_method=auth_method,
                )

        if scoped_subject and self.required_scopes is None:
            return Auth(
                scoped_subject=scoped_subject,
                auth_method=auth_method,
            )

        if self.fallback_to_anonymous:
            return Auth(
                scoped_subject=ScopedSubject(subject=Anonymous(), scopes=[]),
                auth_method=None,
            )

        raise HTTPException(
            status_code=403,
            detail=f"Missing required scope: have={",".join(scoped_subject.scopes)} requires={",".join(self.required_scopes or [])}",
        )


# WebOrAnonymous is the scope aware alternative to Auth.optional_user
WebOrAnonymous = AuthenticatedWithScope(
    required_scopes=[Scope.web_default],
    fallback_to_anonymous=True,
    allow_anonymous=True,
)
