from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_OrdersRead = Authenticator(
    required_scopes={Scope.web_default, Scope.orders_read},
    allowed_subjects={User, Organization},
)
OrdersRead = Annotated[AuthSubject[User | Organization], Depends(_OrdersRead)]
