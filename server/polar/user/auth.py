from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

_UsersWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.users_write,
    },
    allowed_subjects={User},
)
UsersWrite = Annotated[AuthSubject[User], Depends(_UsersWrite)]
