from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

SECTION_SCOPES = {
    "settings": (Scope.organizations_read, Scope.organizations_write),
    "meters": (Scope.meters_read, Scope.meters_write),
    "benefits": (Scope.benefits_read, Scope.benefits_write),
    "products": (Scope.products_read, Scope.products_write),
    "webhooks": (Scope.webhooks_read, Scope.webhooks_write),
}

_ConfigRead = Authenticator(
    required_scopes={scope for scopes in SECTION_SCOPES.values() for scope in scopes},
    allowed_subjects={User, Organization, Agent},
)
ConfigRead = Annotated[AuthSubject[User | Organization | Agent], Depends(_ConfigRead)]

_ConfigWrite = Authenticator(
    required_scopes={write_scope for _, write_scope in SECTION_SCOPES.values()},
    allowed_subjects={User, Organization, Agent},
)
ConfigWrite = Annotated[AuthSubject[User | Organization | Agent], Depends(_ConfigWrite)]
