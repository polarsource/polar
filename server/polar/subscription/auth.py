from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Auth, AuthenticatedWithScope, AuthRequired
from polar.authz.scope import Scope

_TiersReadOrAnonymousAuth = AuthenticatedWithScope(
    required_scopes=[Scope.web_default, Scope.subscription_tiers_read],
    allow_anonymous=True,
    fallback_to_anonymous=True,
)
TiersReadOrAnonymousAuth = Annotated[Auth, Depends(_TiersReadOrAnonymousAuth)]

_TiersReadAuth = AuthenticatedWithScope(
    required_scopes=[Scope.web_default, Scope.subscription_tiers_read]
)
TiersReadAuth = Annotated[AuthRequired, Depends(_TiersReadAuth)]

_TiersWriteAuth = AuthenticatedWithScope(
    required_scopes=[Scope.web_default, Scope.subscription_tiers_write]
)
TiersWriteAuth = Annotated[AuthRequired, Depends(_TiersWriteAuth)]


_SubscriptionsReadOrAnonymousAuth = AuthenticatedWithScope(
    required_scopes=[Scope.web_default, Scope.subscriptions_read],
    allow_anonymous=True,
    fallback_to_anonymous=True,
)
SubscriptionsReadOrAnonymousAuth = Annotated[
    Auth, Depends(_SubscriptionsReadOrAnonymousAuth)
]

_SubscriptionsRead = AuthenticatedWithScope(
    required_scopes=[Scope.web_default, Scope.subscriptions_read]
)
SubscriptionsRead = Annotated[AuthRequired, Depends(_SubscriptionsRead)]

_SubscriptionsWrite = AuthenticatedWithScope(
    required_scopes=[Scope.web_default, Scope.subscriptions_write]
)
SubscriptionsWrite = Annotated[AuthRequired, Depends(_SubscriptionsWrite)]
