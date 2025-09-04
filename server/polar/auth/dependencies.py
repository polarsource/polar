from collections.abc import Awaitable, Callable
from inspect import Parameter, Signature
from typing import Annotated, Any

from fastapi import Depends, Request, Security
from fastapi.security import HTTPBearer, OpenIdConnect
from makefun import with_signature

from polar.auth.scope import RESERVED_SCOPES, Scope
from polar.exceptions import Unauthorized
from polar.oauth2.exceptions import InsufficientScopeError

from .models import (
    Anonymous,
    AuthSubject,
    Customer,
    Organization,
    Subject,
    SubjectType,
    User,
    is_anonymous,
)

oidc_scheme = OpenIdConnect(
    scheme_name="oidc",
    openIdConnectUrl="/.well-known/openid-configuration",
    auto_error=False,
)
oat_scheme = HTTPBearer(
    scheme_name="oat",
    auto_error=False,
    description="You can generate an **Organization Access Token** from your organization's settings.",
)
pat_scheme = HTTPBearer(
    scheme_name="pat",
    auto_error=False,
    description="You can generate a **Personal Access Token** from your [settings](https://polar.sh/settings).",
)
customer_session_scheme = HTTPBearer(
    scheme_name="customer_session",
    auto_error=False,
    description=(
        "Customer session tokens are specific tokens "
        "that are used to authenticate customers on your organization. "
        "You can create those sessions programmatically using the "
        "[Create Customer Session endpoint](/api-reference/customer-portal/sessions/create)."
    ),
)


_auth_subject_factory_cache: dict[
    frozenset[SubjectType], Callable[..., Awaitable[AuthSubject[Subject]]]
] = {}


def _get_auth_subject_factory(
    allowed_subjects: frozenset[SubjectType],
) -> Callable[..., Awaitable[AuthSubject[Subject]]]:
    if allowed_subjects in _auth_subject_factory_cache:
        return _auth_subject_factory_cache[allowed_subjects]

    parameters: list[Parameter] = [
        Parameter(
            name="request",
            kind=Parameter.POSITIONAL_OR_KEYWORD,
            annotation=Request,
        )
    ]
    if User in allowed_subjects or Organization in allowed_subjects:
        parameters += [
            Parameter(
                name="oauth2_credentials",
                kind=Parameter.KEYWORD_ONLY,
                default=Depends(oidc_scheme),
            )
        ]
    if User in allowed_subjects:
        parameters += [
            Parameter(
                name="personal_access_token_credentials",
                kind=Parameter.KEYWORD_ONLY,
                default=Depends(pat_scheme),
            ),
        ]
    if Organization in allowed_subjects:
        parameters += [
            Parameter(
                name="organization_access_token_credentials",
                kind=Parameter.KEYWORD_ONLY,
                default=Depends(oat_scheme),
            )
        ]
    if Customer in allowed_subjects:
        parameters.append(
            Parameter(
                name="customer_session_credentials",
                kind=Parameter.KEYWORD_ONLY,
                default=Depends(customer_session_scheme),
            )
        )

    signature = Signature(parameters)

    @with_signature(signature)
    async def get_auth_subject(request: Request, **kwargs: Any) -> AuthSubject[Subject]:
        try:
            return request.state.auth_subject
        except AttributeError as e:
            raise RuntimeError(
                "AuthSubject is not present in the request state. "
                "Did you forget to add AuthSubjectMiddleware?"
            ) from e

    _auth_subject_factory_cache[allowed_subjects] = get_auth_subject

    return get_auth_subject


class _Authenticator:
    def __init__(
        self,
        *,
        allowed_subjects: frozenset[SubjectType],
        required_scopes: set[Scope] | None = None,
    ) -> None:
        self.allowed_subjects = allowed_subjects
        self.required_scopes = required_scopes

    async def __call__(
        self, auth_subject: AuthSubject[Subject]
    ) -> AuthSubject[Subject]:
        # Not allowed subject, fallback to Anonymous
        subject_type = type(auth_subject.subject)
        if subject_type not in self.allowed_subjects:
            auth_subject = AuthSubject(Anonymous(), set(), None)

        # Anonymous
        if is_anonymous(auth_subject):
            if Anonymous in self.allowed_subjects:
                return auth_subject
            else:
                raise Unauthorized()

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
    allowed_subjects_frozen = frozenset(allowed_subjects)

    parameters: list[Parameter] = [
        Parameter(name="self", kind=Parameter.POSITIONAL_OR_KEYWORD),
        Parameter(
            name="auth_subject",
            kind=Parameter.POSITIONAL_OR_KEYWORD,
            default=Security(
                _get_auth_subject_factory(allowed_subjects_frozen),
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
        allowed_subjects=allowed_subjects_frozen, required_scopes=required_scopes
    )


_WebUserOrAnonymous = Authenticator(
    allowed_subjects={Anonymous, User},
    required_scopes={Scope.web_write},
)
WebUserOrAnonymous = Annotated[
    AuthSubject[Anonymous | User], Depends(_WebUserOrAnonymous)
]

_WebUserRead = Authenticator(
    allowed_subjects={User}, required_scopes={Scope.web_read, Scope.web_write}
)
WebUserRead = Annotated[AuthSubject[User], Depends(_WebUserRead)]

_WebUserWrite = Authenticator(
    allowed_subjects={User}, required_scopes={Scope.web_write}
)
WebUserWrite = Annotated[AuthSubject[User], Depends(_WebUserWrite)]
