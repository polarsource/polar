from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

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
