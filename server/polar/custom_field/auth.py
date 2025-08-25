from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_CustomFieldRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.custom_fields_read,
        Scope.custom_fields_write,
    },
    allowed_subjects={User, Organization},
)
CustomFieldRead = Annotated[AuthSubject[User | Organization], Depends(_CustomFieldRead)]

_CustomFieldWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.custom_fields_write,
    },
    allowed_subjects={User, Organization},
)
CustomFieldWrite = Annotated[
    AuthSubject[User | Organization], Depends(_CustomFieldWrite)
]
