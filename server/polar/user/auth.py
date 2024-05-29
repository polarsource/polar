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

_UserSubscriptionsRead = Authenticator(
    required_scopes={Scope.web_default, Scope.user_subscriptions_read},
    allowed_subjects={User},
)
UserSubscriptionsRead = Annotated[AuthSubject[User], Depends(_UserSubscriptionsRead)]

_UserSubscriptionsWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.user_subscriptions_write},
    allowed_subjects={User},
)
UserSubscriptionsWrite = Annotated[AuthSubject[User], Depends(_UserSubscriptionsWrite)]
