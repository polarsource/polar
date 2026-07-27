from typing import Annotated

from fastapi import Depends

from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.authz.dependencies import WebUserAuthorizer, WebUserAuthorizerFresh

_OrganizationAccessTokensRead = WebUserAuthorizer(
    required_scopes={
        Scope.organization_access_tokens_read,
        Scope.organization_access_tokens_write,
    }
)
OrganizationAccessTokensRead = Annotated[
    AuthSubject[User], Depends(_OrganizationAccessTokensRead)
]

_OrganizationAccessTokensWrite = WebUserAuthorizer(
    required_scopes={
        Scope.organization_access_tokens_write,
    }
)
OrganizationAccessTokensWrite = Annotated[
    AuthSubject[User], Depends(_OrganizationAccessTokensWrite)
]

_OrganizationAccessTokensWriteFresh = WebUserAuthorizerFresh(
    required_scopes={
        Scope.organization_access_tokens_write,
    }
)
OrganizationAccessTokensWriteFresh = Annotated[
    AuthSubject[User], Depends(_OrganizationAccessTokensWriteFresh)
]
