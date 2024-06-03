from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

UserDownloadablesRead = Annotated[
    AuthSubject[User],
    Depends(
        Authenticator(
            required_scopes={
                Scope.web_default,
                Scope.user_downloadables_read,
            },
            allowed_subjects={User},
        )
    ),
]
