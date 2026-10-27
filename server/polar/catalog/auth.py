from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, Organization, User
from polar.auth.scope import Scope

_CatalogRead = Authenticator(
    required_scopes={Scope.products_read, Scope.products_write},
    allowed_subjects={User, Organization, Agent},
)
CatalogRead = Annotated[AuthSubject[User | Organization | Agent], Depends(_CatalogRead)]
