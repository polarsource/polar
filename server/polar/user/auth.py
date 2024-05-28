from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

_UserOrdersRead = Authenticator(
    required_scopes={Scope.web_default, Scope.user_orders_read},
    allowed_subjects={User},
)
UserOrdersRead = Annotated[AuthSubject[User], Depends(_UserOrdersRead)]
