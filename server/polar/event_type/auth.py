from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_EventTypeRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.events_read,
        Scope.events_write,
    },
    allowed_subjects={User, Organization},
)
EventTypeRead = Annotated[AuthSubject[User | Organization], Depends(_EventTypeRead)]

_EventTypeWrite = Authenticator(
    required_scopes={
        Scope.web_write,
    },
    allowed_subjects={User, Organization},
)
EventTypeWrite = Annotated[AuthSubject[User | Organization], Depends(_EventTypeWrite)]
