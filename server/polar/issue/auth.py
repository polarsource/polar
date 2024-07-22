from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, Organization, User
from polar.auth.scope import Scope

_IssuesReadOrAnonymous = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.issues_read,
        Scope.issues_write,
    },
    allowed_subjects={Anonymous, User, Organization},
)
IssuesReadOrAnonymous = Annotated[
    AuthSubject[Anonymous | User | Organization], Depends(_IssuesReadOrAnonymous)
]

_IssuesRead = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.issues_read,
        Scope.issues_write,
    },
    allowed_subjects={User, Organization},
)
IssuesRead = Annotated[AuthSubject[User | Organization], Depends(_IssuesRead)]

_IssuesWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.issues_write},
    allowed_subjects={User, Organization},
)
IssuesWrite = Annotated[AuthSubject[User | Organization], Depends(_IssuesWrite)]
