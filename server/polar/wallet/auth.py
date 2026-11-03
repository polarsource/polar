from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_WalletsRead = Authenticator(
    required_scopes={Scope.wallets_read},
    allowed_subjects={User, Organization},
)
WalletsRead = Annotated[AuthSubject[User | Organization], Depends(_WalletsRead)]
