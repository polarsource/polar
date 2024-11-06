from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, Organization, User
from polar.auth.scope import Scope

EmbedsRead = Annotated[
    AuthSubject[Anonymous | User | Organization],
    Depends(
        Authenticator(
            required_scopes={
                Scope.web_default,
            },
            allowed_subjects={Anonymous, User, Organization},
        )
    ),
]
