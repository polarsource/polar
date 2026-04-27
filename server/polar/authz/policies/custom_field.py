from polar.auth.models import AuthSubject, Organization, User
from polar.authz.types import PolicyResult
from polar.models import Organization as OrganizationModel
from polar.postgres import AsyncReadSession


async def can_read(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Any subject with access to the org can read its custom fields."""
    return True


async def can_write(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    """Any subject with access to the org can write its custom fields."""
    return True
