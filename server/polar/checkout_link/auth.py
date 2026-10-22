from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_CheckoutLinkRead = Authenticator(
    required_scopes={
        Scope.checkout_links_read,
        Scope.checkout_links_write,
    },
    allowed_subjects={User, Organization, Agent},
)
CheckoutLinkRead = Annotated[
    AuthSubject[User | Organization | Agent], Depends(_CheckoutLinkRead)
]

_CheckoutLinkWrite = Authenticator(
    required_scopes={
        Scope.checkout_links_write,
    },
    allowed_subjects={User, Organization, Agent},
)
CheckoutLinkWrite = Annotated[
    AuthSubject[User | Organization | Agent], Depends(_CheckoutLinkWrite)
]
