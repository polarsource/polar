from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.postgres import AsyncReadSession

from .repository import AuthzRepository


async def get_accessible_org_ids(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
) -> set[UUID]:
    """Resolve which organization IDs this subject can access."""
    if is_organization(auth_subject):
        return {auth_subject.subject.id}
    if is_user(auth_subject):
        repository = AuthzRepository(session)
        return await repository.get_user_org_ids(auth_subject.subject.id)
    return set()
