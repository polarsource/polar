from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization
from polar.auth.scope import Scope

OutpostWrite = Annotated[
    AuthSubject[Organization],
    Depends(
        Authenticator(
            required_scopes={Scope.events_write}, allowed_subjects={Organization}
        )
    ),
]
