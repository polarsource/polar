from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, Organization, User
from polar.auth.scope import Scope

AnonymousOrganizationsRead = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={
                Scope.web_default,
                Scope.organizations_read,
                Scope.organizations_write,
            },
            allowed_subjects={Anonymous, User, Organization},
        )
    ),
]

OrganizationsRead = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={
                Scope.web_default,
                Scope.organizations_read,
                Scope.organizations_write,
            },
            allowed_subjects={User, Organization},
        )
    ),
]

OrganizationsWrite = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={Scope.web_default, Scope.organizations_write},
            allowed_subjects={User, Organization},
        )
    ),
]
