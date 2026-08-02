from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

# Compass is a read-layer on top of metrics, so it reuses the metrics scope
# rather than introducing a new scope (which would touch token validation).
_CompassRead = Authenticator(
    required_scopes={Scope.metrics_read},
    allowed_subjects={User, Organization},
)
CompassRead = Annotated[AuthSubject[User | Organization], Depends(_CompassRead)]

# Renaming or deleting threads is destructive, so a read-only analytics token
# must not be enough — org-token threads are shared across the whole org.
_CompassWrite = Authenticator(
    required_scopes={Scope.metrics_write},
    allowed_subjects={User, Organization},
)
CompassWrite = Annotated[AuthSubject[User | Organization], Depends(_CompassWrite)]
