from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_CheckoutLinkRead = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.checkout_links_read,
        Scope.checkout_links_write,
    },
    allowed_subjects={User, Organization},
)
CheckoutLinkRead = Annotated[
    AuthSubject[User | Organization], Depends(_CheckoutLinkRead)
]

_CheckoutLinkWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.checkout_links_write},
    allowed_subjects={User, Organization},
)
CheckoutLinkWrite = Annotated[
    AuthSubject[User | Organization], Depends(_CheckoutLinkWrite)
]
