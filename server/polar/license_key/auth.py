from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

LicenseKeysRead = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={
                Scope.web_default,
                Scope.user_license_keys_read,
                Scope.user_license_keys_write,
            },
            allowed_subjects={User, Organization},
        )
    ),
]

LicenseKeysWrite = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={
                Scope.web_default,
                Scope.user_license_keys_write,
            },
            allowed_subjects={User, Organization},
        )
    ),
]
