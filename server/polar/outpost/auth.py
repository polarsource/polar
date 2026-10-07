from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.models.organization import Organization

_OutpostAuth = Authenticator(
    required_scopes={
        Scope.events_read,
        Scope.events_write,
    },
    allowed_subjects={Organization},
)
OutpostAuth = Annotated[AuthSubject[Organization], Depends(_OutpostAuth)]
