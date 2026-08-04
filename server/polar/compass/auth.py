from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_CompassRead = Authenticator(
    required_scopes={Scope.metrics_read},
    allowed_subjects={User, Organization},
)
CompassRead = Annotated[AuthSubject[User | Organization], Depends(_CompassRead)]

# Write scope: org-token threads are shared, so rename/delete must not be read-only.
_CompassWrite = Authenticator(
    required_scopes={Scope.metrics_write},
    allowed_subjects={User, Organization},
)
CompassWrite = Annotated[AuthSubject[User | Organization], Depends(_CompassWrite)]
