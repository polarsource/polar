from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.auth.permission import (
    PERMISSION_DENIED_MESSAGE,
    ROLE_PERMISSIONS,
    OrganizationPermission,
)
from polar.authz.types import PolicyResult
from polar.models import Organization as OrganizationModel
from polar.postgres import AsyncReadSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)


async def _require_permission(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
    *,
    permission: OrganizationPermission,
) -> PolicyResult:
    """Check that the subject's role on the organization grants ``permission``.

    Organization-token subjects are always permitted (the token *is* the org).
    User subjects are permitted iff their ``UserOrganization.role`` grants the
    permission per ``ROLE_PERMISSIONS``. On denial, returns the canonical
    message for ``permission`` from ``PERMISSION_DENIED_MESSAGE``.
    """
    if is_organization(auth_subject):
        return True
    if is_user(auth_subject):
        user_org = await user_organization_service.get_by_user_and_org(
            session, auth_subject.subject.id, organization.id
        )
        if user_org is not None and permission in ROLE_PERMISSIONS[user_org.role]:
            return True
    return PERMISSION_DENIED_MESSAGE[permission]
