from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_BenefitsRead = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.creator_benefits_read,
        Scope.creator_benefits_write,
    },
    allowed_subjects={User, Organization},
)
BenefitsRead = Annotated[AuthSubject[User | Organization], Depends(_BenefitsRead)]

_BenefitsWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.creator_benefits_write},
    allowed_subjects={User, Organization},
)
BenefitsWrite = Annotated[AuthSubject[User | Organization], Depends(_BenefitsWrite)]
