from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

# Perks are public, but we need a user to track claims
_PerksRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
    },
    allowed_subjects={User},
)
PerksRead = Annotated[AuthSubject[User], Depends(_PerksRead)]

# Claiming perks requires authentication
_PerksWrite = Authenticator(
    required_scopes={
        Scope.web_write,
    },
    allowed_subjects={User},
)
PerksWrite = Annotated[AuthSubject[User], Depends(_PerksWrite)]
