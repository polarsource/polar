from inspect import Parameter, Signature
from typing import Annotated

from fastapi import Depends, Request, Security
from makefun import with_signature

from polar.auth.scope import RESERVED_SCOPES, Scope
from polar.customer_session.dependencies import get_optional_customer_session_token
from polar.exceptions import NotPermitted, Unauthorized
from polar.models import CustomerSession, OAuth2Token, PersonalAccessToken, UserSession
from polar.oauth2.dependencies import get_optional_token
from polar.oauth2.exceptions import InsufficientScopeError, InvalidTokenError
from polar.personal_access_token.dependencies import get_optional_personal_access_token
from polar.postgres import AsyncSession, get_db_session
from polar.sentry import set_sentry_user

from .models import (
    Anonymous,
    AuthMethod,
    AuthSubject,
    Subject,
    SubjectType,
    User,
    is_anonymous,
)
from .service import auth as auth_service


async def get_user_session(
    request: Request, session: AsyncSession = Depends(get_db_session)
) -> UserSession | None:
    return await auth_service.authenticate(session, request)


async def get_auth_subject(
    user_session: UserSession | None = Depends(get_user_session),
    oauth2_credentials: tuple[OAuth2Token | None, bool] = Depends(get_optional_token),
    personal_access_token_credentials: tuple[
        PersonalAccessToken | None, bool
    ] = Depends(get_optional_personal_access_token),
    customer_session_credentials: tuple[CustomerSession | None, bool] = Depends(
        get_optional_customer_session_token
    ),
) -> AuthSubject[Subject]:
    # Web session
    if user_session is not None:
        user = user_session.user
        scopes = {Scope.web_default}
        if user.github_username in {
            "birkjernstrom",
            "frankie567",
            "emilwidlund",
        }:
            scopes.add(Scope.admin)
        return AuthSubject(user, scopes, AuthMethod.COOKIE)

    oauth2_token, oauth2_authorization_set = oauth2_credentials
    personal_access_token, personal_access_token_authorization_set = (
        personal_access_token_credentials
    )
    customer_session, customer_session_authorization_set = customer_session_credentials

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

    if customer_session:
        return AuthSubject(
            customer_session.customer,
            {Scope.customer_portal_write},
            AuthMethod.CUSTOMER_SESSION_TOKEN,
        )

    if any(
        (
            oauth2_authorization_set,
            personal_access_token_authorization_set,
            customer_session_authorization_set,
        )
    ):
        raise InvalidTokenError()

    return AuthSubject(Anonymous(), set(), AuthMethod.NONE)


class _Authenticator:
    def __init__(
        self,
        *,
        allowed_subjects: set[SubjectType],
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
            raise InvalidTokenError(
                "The subject of this access token is not valid for this endpoint.",
                allowed_subjects=" ".join(s.__name__ for s in self.allowed_subjects),
            )

        # No required scopes
        if not self.required_scopes:
            return auth_subject

        # Have at least one of the required scopes. Allow this request.
        if auth_subject.scopes & self.required_scopes:
            return auth_subject

        raise InsufficientScopeError({s for s in self.required_scopes})


def Authenticator(
    allowed_subjects: set[SubjectType],
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
                scopes=sorted(
                    [
                        s.value
                        for s in (required_scopes or {})
                        if s not in RESERVED_SCOPES
                    ]
                ),
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
