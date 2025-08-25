from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_MeterRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.meters_read,
        Scope.meters_write,
    },
    allowed_subjects={User, Organization},
)
MeterRead = Annotated[AuthSubject[User | Organization], Depends(_MeterRead)]

_MeterWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.meters_write,
    },
    allowed_subjects={User, Organization},
)
MeterWrite = Annotated[AuthSubject[User | Organization], Depends(_MeterWrite)]
