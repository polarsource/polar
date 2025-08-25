from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

_PayoutsRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.payouts_read,
    },
    allowed_subjects={User},
)
PayoutsRead = Annotated[AuthSubject[User], Depends(_PayoutsRead)]

_PayoutsWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.payouts_write,
    },
    allowed_subjects={User},
)
PayoutsWrite = Annotated[AuthSubject[User], Depends(_PayoutsWrite)]
