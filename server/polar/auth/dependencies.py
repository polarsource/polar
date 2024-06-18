from inspect import Parameter, Signature
from typing import Annotated

from fastapi import Depends, Request, Security
from makefun import with_signature

from polar.auth.scope import RESERVED_SCOPES, Scope
from polar.config import settings
from polar.exceptions import NotPermitted, PolarError, Unauthorized
from polar.models import OAuth2Token, PersonalAccessToken
from polar.oauth2.dependencies import get_optional_token
from polar.personal_access_token.dependencies import get_optional_personal_access_token
from polar.postgres import AsyncSession, get_db_session
from polar.sentry import set_sentry_user

from .exceptions import MissingScope
from .models import (
    SUBJECTS,
    Anonymous,
    AuthMethod,
    AuthSubject,
    Subject,
    SubjectType,
    User,
    is_anonymous,
)
from .service import AuthService


class UnsupportedSubjectType(PolarError):
    def __init__(self, subject_type: SubjectType) -> None:
        message = f"This endpoint does not support {subject_type.__name__} tokens."
        return super().__init__(message, 400)


async def _get_cookie_token(request: Request) -> str | None:
    return request.cookies.get(settings.AUTH_COOKIE_KEY)


async def get_auth_subject(
    cookie_token: str | None = Depends(_get_cookie_token),
    oauth2_token: OAuth2Token | None = Depends(get_optional_token),
    personal_access_token: PersonalAccessToken | None = Depends(
        get_optional_personal_access_token
    ),
    session: AsyncSession = Depends(get_db_session),
) -> AuthSubject[Subject]:
    if cookie_token is not None:
        user = await AuthService.get_user_from_cookie(session, cookie=cookie_token)
        if user:
            scopes = {Scope.web_default}
            if user.github_username in {
                "birkjernstrom",
                "frankie567",
                "emilwidlund",
            }:
                scopes.add(Scope.admin)
            return AuthSubject(user, scopes, AuthMethod.COOKIE)

    if oauth2_token:
        return AuthSubject(
            oauth2_token.sub, oauth2_token.scopes, AuthMethod.OAUTH2_ACCESS_TOKEN
        )

    if personal_access_token:
        return AuthSubject(
            personal_access_token.user,
            personal_access_token.scopes,
            AuthMethod.PERSONAL_ACCESS_TOKEN,
        )

    return AuthSubject(Anonymous(), set(), AuthMethod.NONE)


class _Authenticator:
    def __init__(
        self,
        *,
        allowed_subjects: set[SubjectType] = SUBJECTS,
        required_scopes: set[Scope] | None = None,
    ) -> None:
        self.allowed_subjects = allowed_subjects
        self.required_scopes = required_scopes

    async def __call__(
        self, auth_subject: AuthSubject[Subject]
    ) -> AuthSubject[Subject]:
        # Anonymous
        if is_anonymous(auth_subject):
            if Anonymous in self.allowed_subjects:
                return auth_subject
            else:
                raise Unauthorized()

        set_sentry_user(auth_subject)

        # Blocked subjects
        blocked_at = getattr(auth_subject.subject, "blocked_at", None)
        if blocked_at is not None:
            raise NotPermitted()

        # Not allowed subject
        subject_type = type(auth_subject.subject)
        if subject_type not in self.allowed_subjects:
            raise UnsupportedSubjectType(subject_type)

        # No required scopes
        if not self.required_scopes:
            return auth_subject

        # Have at least one of the required scopes. Allow this request.
        if auth_subject.scopes & self.required_scopes:
            return auth_subject

        raise MissingScope(auth_subject.scopes, self.required_scopes)


def Authenticator(
    allowed_subjects: set[SubjectType] = SUBJECTS,
    required_scopes: set[Scope] | None = None,
) -> _Authenticator:
    """
    Here comes some blood magic 🧙‍♂️

    Generate a version of `_Authenticator` with an overriden `__call__` signature.

    By doing so, we can dynamically inject the required scopes into FastAPI
    dependency, so they are properrly detected by the OpenAPI generator.
    """
    parameters: list[Parameter] = [
        Parameter(name="self", kind=Parameter.POSITIONAL_OR_KEYWORD),
        Parameter(
            name="auth_subject",
            kind=Parameter.POSITIONAL_OR_KEYWORD,
            default=Security(
                get_auth_subject,
                scopes=[
                    s.value for s in (required_scopes or {}) if s not in RESERVED_SCOPES
                ],
            ),
        ),
    ]
    signature = Signature(parameters)

    class _AuthenticatorSignature(_Authenticator):
        @with_signature(signature)
        async def __call__(
            self, auth_subject: AuthSubject[Subject]
        ) -> AuthSubject[Subject]:
            return await super().__call__(auth_subject)

    return _AuthenticatorSignature(
        allowed_subjects=allowed_subjects, required_scopes=required_scopes
    )


_WebUserOrAnonymous = Authenticator(
    allowed_subjects={Anonymous, User}, required_scopes={Scope.web_default}
)
WebUserOrAnonymous = Annotated[
    AuthSubject[Anonymous | User], Depends(_WebUserOrAnonymous)
]

_WebUser = Authenticator(allowed_subjects={User}, required_scopes={Scope.web_default})
WebUser = Annotated[AuthSubject[User], Depends(_WebUser)]

_AdminUser = Authenticator(allowed_subjects={User}, required_scopes={Scope.admin})
AdminUser = Annotated[AuthSubject[User], Depends(_AdminUser)]
