from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_DiscountRead = Authenticator(
    required_scopes={
        Scope.discounts_read,
        Scope.discounts_write,
    },
    allowed_subjects={User, Organization, Agent},
)
DiscountRead = Annotated[
    AuthSubject[User | Organization | Agent], Depends(_DiscountRead)
]

_DiscountWrite = Authenticator(
    required_scopes={
        Scope.discounts_write,
    },
    allowed_subjects={User, Organization, Agent},
)
DiscountWrite = Annotated[
    AuthSubject[User | Organization | Agent], Depends(_DiscountWrite)
]
