from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_AuditRead = Authenticator(
    required_scopes={Scope.audit_read},
    allowed_subjects={User, Organization},
)
AuditRead = Annotated[AuthSubject[User | Organization], Depends(_AuditRead)]
