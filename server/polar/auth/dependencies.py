from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from polar.auth.scope import Scope
from polar.config import settings
from polar.exceptions import NotPermitted, PolarError, Unauthorized
from polar.models import OAuth2Token
from polar.oauth2.dependencies import get_optional_token
from polar.postgres import AsyncSession, get_db_session

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


auth_header_scheme = HTTPBearer(
    auto_error=False,
    description="You can generate a **Personal Access Token** from your [settings](https://polar.sh/settings).",
)


async def _get_cookie_token(request: Request) -> str | None:
    return request.cookies.get(settings.AUTH_COOKIE_KEY)


async def get_auth_subject(
    cookie_token: str | None = Depends(_get_cookie_token),
    oauth2_token: OAuth2Token | None = Depends(get_optional_token),
    auth_header: HTTPAuthorizationCredentials | None = Depends(auth_header_scheme),
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
            oauth2_token.sub, oauth2_token.get_scopes(), AuthMethod.OAUTH2_ACCESS_TOKEN
        )

    # Authorization header.
    # Can contain both a PAT and a forwarded cookie value (via Next/Vercel)
    if auth_header is not None:
        user_scopes = await AuthService.get_user_from_auth_header(
            session, token=auth_header.credentials
        )

        if user_scopes:
            user, scopes = user_scopes
            return AuthSubject(user, scopes, AuthMethod.PERSONAL_ACCESS_TOKEN)

    return AuthSubject(Anonymous(), set(), AuthMethod.NONE)


class Authenticator:
    allowed_subjects: set[SubjectType]
    required_scopes: set[Scope]

    def __init__(
        self,
        *,
        allowed_subjects: set[SubjectType] = SUBJECTS,
        required_scopes: set[Scope] | None = None,
    ):
        self.allowed_subjects = allowed_subjects
        self.required_scopes = required_scopes or set()

    def __call__(
        self, auth_subject: AuthSubject[Subject] = Depends(get_auth_subject)
    ) -> AuthSubject[Subject]:
        # Anonymous
        if is_anonymous(auth_subject):
            if Anonymous in self.allowed_subjects:
                return auth_subject
            else:
                raise Unauthorized()

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

        raise NotPermitted(
            "Missing required scope: "
            f"have={','.join(auth_subject.scopes)} "
            f"requires={','.join(self.required_scopes)}"
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
