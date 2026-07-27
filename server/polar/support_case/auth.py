from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_SupportCasesRead = Authenticator(
    required_scopes={Scope.organizations_read, Scope.organizations_write},
    allowed_subjects={User, Organization},
)
SupportCasesRead = Annotated[
    AuthSubject[User | Organization], Depends(_SupportCasesRead)
]

_SupportCasesWrite = Authenticator(
    required_scopes={Scope.organizations_write},
    allowed_subjects={User},
)
SupportCasesWrite = Annotated[AuthSubject[User], Depends(_SupportCasesWrite)]
