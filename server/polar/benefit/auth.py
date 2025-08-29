from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_BenefitsRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.benefits_read,
        Scope.benefits_write,
    },
    allowed_subjects={User, Organization},
)
BenefitsRead = Annotated[AuthSubject[User | Organization], Depends(_BenefitsRead)]

_BenefitsWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.benefits_write,
    },
    allowed_subjects={User, Organization},
)
BenefitsWrite = Annotated[AuthSubject[User | Organization], Depends(_BenefitsWrite)]
