from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, Customer
from polar.auth.scope import Scope

_CustomerPortalRead = Authenticator(
    required_scopes={
        Scope.customer_portal_read,
        Scope.customer_portal_write,
    },
    allowed_subjects={Customer},
)
CustomerPortalRead = Annotated[AuthSubject[Customer], Depends(_CustomerPortalRead)]

_CustomerPortalWrite = Authenticator(
    required_scopes={Scope.customer_portal_write},
    allowed_subjects={Customer},
)
CustomerPortalWrite = Annotated[AuthSubject[Customer], Depends(_CustomerPortalWrite)]

_CustomerPortalOAuthAccount = Authenticator(
    required_scopes={Scope.customer_portal_write},
    allowed_subjects={Customer, Anonymous},
)
CustomerPortalOAuthAccount = Annotated[
    AuthSubject[Customer | Anonymous], Depends(_CustomerPortalOAuthAccount)
]
