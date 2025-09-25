from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_DiscountRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.discounts_read,
        Scope.discounts_write,
    },
    allowed_subjects={User, Organization},
)
DiscountRead = Annotated[AuthSubject[User | Organization], Depends(_DiscountRead)]

_DiscountWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.discounts_write,
    },
    allowed_subjects={User, Organization},
)
DiscountWrite = Annotated[AuthSubject[User | Organization], Depends(_DiscountWrite)]
