from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.models.organization import Organization as OrganizationModel
from polar.postgres import AsyncReadSession

from .repository import AuthzRepository
from .types import AccessibleOrganizationID


async def get_accessible_org_ids(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
) -> set[AccessibleOrganizationID]:
    """Resolve which organization IDs this subject can access."""
    if is_organization(auth_subject):
        return {AccessibleOrganizationID(auth_subject.subject.id)}
    if is_user(auth_subject):
        repository = AuthzRepository(session)
        raw_ids = await repository.get_user_org_ids(auth_subject.subject.id)
        return {AccessibleOrganizationID(uid) for uid in raw_ids}
    return set()


async def get_accessible_organization(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization_id: UUID,
) -> OrganizationModel | None:
    """Fetch an organization by ID, returning it only if the subject can access it."""
    repository = AuthzRepository(session)
    return await repository.get_accessible_organization(auth_subject, organization_id)
