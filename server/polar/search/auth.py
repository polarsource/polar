from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

_SearchRead = Authenticator(
    required_scopes={
        Scope.web_read,
    },
    allowed_subjects={User},
)
SearchRead = Annotated[AuthSubject[User], Depends(_SearchRead)]
