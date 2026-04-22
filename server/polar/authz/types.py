from collections.abc import Awaitable, Callable

from polar.auth.models import AuthSubject, Organization, User
from polar.models import Organization as OrganizationModel
from polar.postgres import AsyncReadSession

# Policy functions return True if allowed, or a denial reason string if denied.
PolicyResult = bool | str

PolicyFn = Callable[
    [AsyncReadSession, AuthSubject[User | Organization], OrganizationModel],
    Awaitable[PolicyResult],
]
