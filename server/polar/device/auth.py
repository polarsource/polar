from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

_DeviceRead = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.devices_read,
        Scope.devices_write,
    },
    allowed_subjects={User},
)
DeviceRead = Annotated[AuthSubject[User], Depends(_DeviceRead)]

_DeviceWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.devices_write},
    allowed_subjects={User},
)
DeviceWrite = Annotated[AuthSubject[User], Depends(_DeviceWrite)]
