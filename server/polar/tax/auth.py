from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_TaxRead = Authenticator(
    required_scopes={Scope.orders_read},
    allowed_subjects={User, Organization},
)
TaxRead = Annotated[AuthSubject[User | Organization], Depends(_TaxRead)]
