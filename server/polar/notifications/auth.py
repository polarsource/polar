from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

_NotificationsRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.notifications_read,
    },
    allowed_subjects={User},
)
NotificationsRead = Annotated[AuthSubject[User], Depends(_NotificationsRead)]

_NotificationsWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.notifications_write,
    },
    allowed_subjects={User},
)
NotificationsWrite = Annotated[AuthSubject[User], Depends(_NotificationsWrite)]
