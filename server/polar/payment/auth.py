from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_PaymentRead = Authenticator(
    required_scopes={
        Scope.web_default,
        Scope.payments_read,
    },
    allowed_subjects={User, Organization},
)
PaymentRead = Annotated[AuthSubject[User | Organization], Depends(_PaymentRead)]
