from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, User
from polar.auth.scope import Scope

_UserBenefitsRead = Authenticator(
    required_scopes={Scope.web_default, Scope.user_benefits_read},
    allowed_subjects={User},
)
UserBenefitsRead = Annotated[AuthSubject[User], Depends(_UserBenefitsRead)]

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

_UserSubscriptionsWriteOrAnonymous = Authenticator(
    required_scopes={Scope.web_default, Scope.user_subscriptions_write},
    allowed_subjects={Anonymous, User},
)
UserSubscriptionsWriteOrAnonymous = Annotated[
    AuthSubject[Anonymous | User], Depends(_UserSubscriptionsWriteOrAnonymous)
]

_UserSubscriptionsWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.user_subscriptions_write},
    allowed_subjects={User},
)
UserSubscriptionsWrite = Annotated[AuthSubject[User], Depends(_UserSubscriptionsWrite)]

_UserAdvertisementCampaignsRead = Authenticator(
    required_scopes={Scope.web_default, Scope.user_advertisement_campaigns_read},
    allowed_subjects={User},
)
UserAdvertisementCampaignsRead = Annotated[
    AuthSubject[User], Depends(_UserAdvertisementCampaignsRead)
]

_UserAdvertisementCampaignsWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.user_advertisement_campaigns_write},
    allowed_subjects={User},
)
UserAdvertisementCampaignsWrite = Annotated[
    AuthSubject[User], Depends(_UserAdvertisementCampaignsWrite)
]
