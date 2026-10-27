from typing import Annotated

from fastapi.params import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, Organization, User
from polar.auth.scope import Scope

_FileRead = Authenticator(
    required_scopes={
        Scope.files_write,
        Scope.files_read,
    },
    allowed_subjects={User, Organization, Agent},
)
FileRead = Annotated[AuthSubject[User | Organization | Agent], Depends(_FileRead)]

_FileWrite = Authenticator(
    required_scopes={
        Scope.files_write,
    },
    allowed_subjects={User, Organization, Agent},
)
FileWrite = Annotated[AuthSubject[User | Organization | Agent], Depends(_FileWrite)]
