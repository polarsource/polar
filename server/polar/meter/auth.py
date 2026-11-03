from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_MeterRead = Authenticator(
    required_scopes={
        Scope.meters_read,
        Scope.meters_write,
    },
    allowed_subjects={User, Organization, Agent},
)
MeterRead = Annotated[AuthSubject[User | Organization | Agent], Depends(_MeterRead)]

_MeterWrite = Authenticator(
    required_scopes={
        Scope.meters_write,
    },
    allowed_subjects={User, Organization, Agent},
)
MeterWrite = Annotated[AuthSubject[User | Organization | Agent], Depends(_MeterWrite)]
