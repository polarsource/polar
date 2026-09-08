from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User, is_web_session
from polar.auth.scope import Scope
from polar.authz.dependencies import ensure_session_fresh
from polar.exceptions import NotPermitted
from polar.models import OAuth2Token


def OrganizationAccessTokenAuthorizer(
    required_scopes: set[Scope], *, fresh: bool = False
) -> Callable[..., Awaitable[AuthSubject[User]]]:
    authenticator = Authenticator(
        allowed_subjects={User}, required_scopes=required_scopes
    )

    async def dependency(
        auth_subject: Annotated[AuthSubject[User], Depends(authenticator)],
    ) -> AuthSubject[User]:
        if is_web_session(auth_subject):
            if fresh:
                ensure_session_fresh(auth_subject)
        elif not isinstance(auth_subject.session, OAuth2Token):
            raise NotPermitted()
        return auth_subject

    return dependency


_OrganizationAccessTokensRead = OrganizationAccessTokenAuthorizer(
    required_scopes={
        Scope.organization_access_tokens_read,
        Scope.organization_access_tokens_write,
    }
)
OrganizationAccessTokensRead = Annotated[
    AuthSubject[User], Depends(_OrganizationAccessTokensRead)
]

_OrganizationAccessTokensWrite = OrganizationAccessTokenAuthorizer(
    required_scopes={
        Scope.organization_access_tokens_write,
    }
)
OrganizationAccessTokensWrite = Annotated[
    AuthSubject[User], Depends(_OrganizationAccessTokensWrite)
]

_OrganizationAccessTokensWriteFresh = OrganizationAccessTokenAuthorizer(
    required_scopes={
        Scope.organization_access_tokens_write,
    },
    fresh=True,
)
OrganizationAccessTokensWriteFresh = Annotated[
    AuthSubject[User], Depends(_OrganizationAccessTokensWriteFresh)
]
