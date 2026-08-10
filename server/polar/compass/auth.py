from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

# Compass is a read-layer on top of metrics, so it reuses the metrics scope
# rather than introducing a new scope (which would touch token validation).
# Threads belong to the user who created them, so an organization token has no
# user to attribute one to.
_CompassRead = Authenticator(
    required_scopes={Scope.metrics_read},
    allowed_subjects={User},
)
CompassRead = Annotated[AuthSubject[User], Depends(_CompassRead)]

# Renaming or deleting a thread is a write, so it must not pass on a read-only
# credential (an impersonation session holds read scopes only).
_CompassWrite = Authenticator(
    required_scopes={Scope.metrics_write},
    allowed_subjects={User},
)
CompassWrite = Annotated[AuthSubject[User], Depends(_CompassWrite)]
