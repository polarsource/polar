from typing import Protocol
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.auth.permission import PERMISSION_DENIED_MESSAGE, OrganizationPermission
from polar.exceptions import NotPermitted
from polar.models.organization import Organization as OrganizationModel
from polar.postgres import AsyncReadSession

from .repository import AuthzRepository
from .types import AccessibleOrganizationID


class _OrgScopedResource(Protocol):
    organization_id: UUID


async def get_accessible_org_ids(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    *,
    permission: OrganizationPermission | None = None,
) -> set[AccessibleOrganizationID]:
    """Resolve which organization IDs this subject can access.

    When ``permission`` is provided, user subjects are further restricted to
    organizations where their `UserOrganization.role` grants that permission.
    Organization-token subjects always pass (the token represents the org
    itself).
    """
    if is_organization(auth_subject):
        return {AccessibleOrganizationID(auth_subject.subject.id)}
    if is_user(auth_subject):
        repository = AuthzRepository.from_session(session)
        raw_ids = await repository.get_user_org_ids(
            auth_subject.subject.id, permission=permission
        )
        return {AccessibleOrganizationID(uid) for uid in raw_ids}
    return set()


async def get_accessible_organization(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization_id: UUID,
) -> OrganizationModel | None:
    """Fetch an organization by ID, returning it only if the subject can access it."""
    repository = AuthzRepository.from_session(session)
    return await repository.get_accessible_organization(auth_subject, organization_id)


async def assert_organization_permission(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization_id: UUID,
    permission: OrganizationPermission,
) -> None:
    """Raise ``NotPermitted`` if the subject does not hold ``permission`` for
    the given organization. The denial message is derived from ``permission``
    via ``PERMISSION_DENIED_MESSAGE``.

    Use at service-layer mutation entry points where the resource has already
    been fetched (so policy-by-OrgPolicyGuard doesn't apply). For payload-driven
    creates, prefer combining with ``get_payload_organization``.

    Important: this helper raises ``NotPermitted`` (403) for BOTH the
    non-member and member-without-permission cases, so callers MUST gate the
    resource fetch first (e.g. ``service.get(..., auth_subject)``) and 404 on
    missing — otherwise the 403 leaks the existence of resources in orgs the
    caller isn't a member of.
    """
    org_ids = await get_accessible_org_ids(session, auth_subject, permission=permission)
    if organization_id not in org_ids:
        raise NotPermitted(PERMISSION_DENIED_MESSAGE[permission])


async def assert_resource_permission(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    resource: _OrgScopedResource,
    permission: OrganizationPermission,
) -> None:
    """Convenience wrapper around ``assert_organization_permission`` that reads
    ``resource.organization_id`` for callers that have already fetched an
    org-scoped resource.

    Same ordering caveat applies: callers MUST gate the resource fetch first
    (e.g. ``service.get(..., auth_subject)``) and 404 on missing.
    """
    await assert_organization_permission(
        session, auth_subject, resource.organization_id, permission
    )
