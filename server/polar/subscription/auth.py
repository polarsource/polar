from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_SubscriptionsRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.subscriptions_read,
        Scope.subscriptions_write,
    },
    allowed_subjects={User, Organization},
)
SubscriptionsRead = Annotated[
    AuthSubject[User | Organization], Depends(_SubscriptionsRead)
]


_SubscriptionsWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.subscriptions_write,
    },
    allowed_subjects={User, Organization},
)
SubscriptionsWrite = Annotated[
    AuthSubject[User | Organization], Depends(_SubscriptionsWrite)
]
