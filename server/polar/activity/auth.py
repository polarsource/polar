from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_ActivityRead = Authenticator(
    required_scopes={Scope.web_default, Scope.activity_read},
    allowed_subjects={User, Organization},
)
ActivityRead = Annotated[AuthSubject[User | Organization], Depends(_ActivityRead)]
