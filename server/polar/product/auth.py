from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_CreatorProductsRead = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.products_read,
        Scope.products_write,
    },
    allowed_subjects={User, Organization},
)
CreatorProductsRead = Annotated[
    AuthSubject[User | Organization], Depends(_CreatorProductsRead)
]

_CreatorProductsWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.products_write},
    allowed_subjects={User, Organization},
)
CreatorProductsWrite = Annotated[
    AuthSubject[User | Organization], Depends(_CreatorProductsWrite)
]
