from typing import Annotated

from fastapi.params import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_FileRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.files_write,
        Scope.files_read,
    },
    allowed_subjects={User, Organization},
)
FileRead = Annotated[AuthSubject[User | Organization], Depends(_FileRead)]

_FileWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.files_write,
    },
    allowed_subjects={User, Organization},
)
FileWrite = Annotated[AuthSubject[User | Organization], Depends(_FileWrite)]
