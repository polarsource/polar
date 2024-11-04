from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

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

OrganizationsCreate = Annotated[
    AuthSubject[User],
    Depends(
        Authenticator(
            required_scopes={Scope.web_default, Scope.organizations_write},
            allowed_subjects={User},
        )
    ),
]
