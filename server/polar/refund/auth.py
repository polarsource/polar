from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

RefundsRead = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={
                Scope.web_default,
                Scope.refunds_read,
                Scope.refunds_write,
            },
            allowed_subjects={User, Organization},
        )
    ),
]

RefundsWrite = Annotated[
    AuthSubject[User | Organization],
    Depends(
        Authenticator(
            required_scopes={
                Scope.web_default,
                Scope.refunds_write,
            },
            allowed_subjects={User, Organization},
        )
    ),
]
