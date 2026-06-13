from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

# Insights are a read-layer on top of metrics, so they reuse the metrics scopes
# rather than introducing a new scope (which would touch token validation).
_InsightsRead = Authenticator(
    required_scopes={Scope.metrics_read},
    allowed_subjects={User, Organization},
)
InsightsRead = Annotated[AuthSubject[User | Organization], Depends(_InsightsRead)]

_InsightsWrite = Authenticator(
    required_scopes={Scope.metrics_write},
    allowed_subjects={User, Organization},
)
InsightsWrite = Annotated[AuthSubject[User | Organization], Depends(_InsightsWrite)]
