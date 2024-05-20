from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

CreatorFilesWrite = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={Scope.web_default, Scope.creator_files_write},
            allowed_subjects={User, Organization},
        )
    ),
]

BackerFilesRead = Annotated[
    AuthSubject[User],
    Depends(
        Authenticator(
            required_scopes={
                Scope.web_default,
                Scope.backer_files_read,
            },
            allowed_subjects={User},
        )
    ),
]
