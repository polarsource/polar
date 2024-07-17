from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, Organization, User
from polar.auth.scope import Scope

_ExternalOrganizationsReadOrAnonymous = Authenticator(
    required_scopes={Scope.web_default, Scope.external_organizations_read},
    allowed_subjects={Anonymous, User, Organization},
)
ExternalOrganizationsReadOrAnonymous = Annotated[
    AuthSubject[Anonymous | User | Organization],
    Depends(_ExternalOrganizationsReadOrAnonymous),
]

_ExternalOrganizationsRead = Authenticator(
    required_scopes={Scope.web_default, Scope.external_organizations_read},
    allowed_subjects={User, Organization},
)
ExternalOrganizationsRead = Annotated[
    AuthSubject[User | Organization], Depends(_ExternalOrganizationsRead)
]
