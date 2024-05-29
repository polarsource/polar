from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, Organization, User
from polar.auth.scope import Scope

_CreatorSubscriptionsReadOrAnonymous = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.creator_subscriptions_read,
        Scope.creator_subscriptions_write,
    },
    allowed_subjects={Anonymous, User, Organization},
)
CreatorSubscriptionsReadOrAnonymous = Annotated[
    AuthSubject[Anonymous | User | Organization],
    Depends(_CreatorSubscriptionsReadOrAnonymous),
]

_CreatorSubscriptionsRead = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.creator_subscriptions_read,
        Scope.creator_subscriptions_write,
    },
    allowed_subjects={User, Organization},
)
CreatorSubscriptionsRead = Annotated[
    AuthSubject[User | Organization], Depends(_CreatorSubscriptionsRead)
]


_CreatorSubscriptionsWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.creator_subscriptions_write},
    allowed_subjects={User, Organization},
)
CreatorSubscriptionsWrite = Annotated[
    AuthSubject[User | Organization], Depends(_CreatorSubscriptionsWrite)
]
