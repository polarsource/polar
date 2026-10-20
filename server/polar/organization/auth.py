from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, Organization, User
from polar.auth.scope import Scope

OrganizationsRead = Annotated[
    AuthSubject[User | Organization | Agent],
    Depends(
        Authenticator(
            required_scopes={
                Scope.organizations_read,
                Scope.organizations_write,
            },
            allowed_subjects={User, Organization, Agent},
        )
    ),
]

OrganizationsCreate = Annotated[
    AuthSubject[User | Agent],
    Depends(
        Authenticator(
            required_scopes={
                Scope.organizations_write,
            },
            allowed_subjects={User, Agent},
        )
    ),
]
