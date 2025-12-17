from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.models.organization import Organization

_CLIRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.webhooks_read,
        Scope.webhooks_write,
    },
    allowed_subjects={Organization},
)
CLIRead = Annotated[AuthSubject[Organization], Depends(_CLIRead)]
