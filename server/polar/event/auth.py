from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User, is_single_organization_credential
from polar.auth.scope import Scope
from polar.exceptions import NotPermitted
from polar.models.organization import Organization

_EventRead = Authenticator(
    required_scopes={
        Scope.events_read,
        Scope.events_write,
    },
    allowed_subjects={User, Organization},
)
EventRead = Annotated[AuthSubject[User | Organization], Depends(_EventRead)]

_EventWrite = Authenticator(
    required_scopes={
        Scope.events_write,
    },
    allowed_subjects={User, Organization},
)
EventWrite = Annotated[AuthSubject[User | Organization], Depends(_EventWrite)]


async def _event_write_single_organization(
    auth_subject: EventWrite,
) -> AuthSubject[User | Organization]:
    if not is_single_organization_credential(auth_subject):
        raise NotPermitted(
            "Ingesting events requires an organization access token, "
            "or an OAuth token scoped to a single organization."
        )
    return auth_subject


EventWriteSingleOrganization = Annotated[
    AuthSubject[User | Organization], Depends(_event_write_single_organization)
]
