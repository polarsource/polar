from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, Organization, User
from polar.auth.scope import Scope

_CreatorProductsRead = Authenticator(
    required_scopes={
        Scope.products_read,
        Scope.products_write,
    },
    allowed_subjects={User, Organization, Agent},
)
CreatorProductsRead = Annotated[
    AuthSubject[User | Organization | Agent], Depends(_CreatorProductsRead)
]

_CreatorProductsWrite = Authenticator(
    required_scopes={
        Scope.products_write,
    },
    allowed_subjects={User, Organization, Agent},
)
CreatorProductsWrite = Annotated[
    AuthSubject[User | Organization | Agent], Depends(_CreatorProductsWrite)
]
