from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_SimulationRead = Authenticator(
    required_scopes={Scope.subscriptions_read, Scope.subscriptions_write},
    allowed_subjects={User, Organization},
)
SimulationRead = Annotated[AuthSubject[User | Organization], Depends(_SimulationRead)]
