from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, Organization, User
from polar.auth.scope import Scope

_RepositoriesReadOrAnonymous = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.repositories_read,
        Scope.repositories_write,
    },
    allowed_subjects={Anonymous, User, Organization},
)
RepositoriesReadOrAnonymous = Annotated[
    AuthSubject[Anonymous | User | Organization], Depends(_RepositoriesReadOrAnonymous)
]

_RepositoriesRead = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.repositories_read,
        Scope.repositories_write,
    },
    allowed_subjects={User, Organization},
)
RepositoriesRead = Annotated[
    AuthSubject[User | Organization], Depends(_RepositoriesRead)
]

_RepositoriesWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.repositories_write},
    allowed_subjects={User, Organization},
)
RepositoriesWrite = Annotated[
    AuthSubject[User | Organization], Depends(_RepositoriesWrite)
]
