from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Customer, User
from polar.auth.scope import Scope

_CustomerPortalRead = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.customer_portal_read,
        Scope.customer_portal_write,
    },
    allowed_subjects={User, Customer},
)
CustomerPortalRead = Annotated[
    AuthSubject[User | Customer], Depends(_CustomerPortalRead)
]

_CustomerPortalWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.customer_portal_write},
    allowed_subjects={User, Customer},
)
CustomerPortalWrite = Annotated[
    AuthSubject[User | Customer], Depends(_CustomerPortalWrite)
]

_CustomerPortalOAuthAccount = Authenticator(
    required_scopes={Scope.web_default, Scope.customer_portal_write},
    allowed_subjects={Customer},
)
CustomerPortalOAuthAccount = Annotated[
    AuthSubject[Customer], Depends(_CustomerPortalOAuthAccount)
]
