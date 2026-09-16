"""Void authentication: an organization token acts as its organization. A user
token names the organization with the ``Polar-Organization-ID`` header, except
when it is already scoped to exactly one organization."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, is_organization, is_user
from polar.auth.permission import OrganizationPermission
from polar.auth.scope import Scope
from polar.authz.dependencies import AuthzContext
from polar.authz.service import (
    assert_organization_permission,
    get_accessible_organization,
)
from polar.customer.auth import CustomerRead, CustomerWrite
from polar.exceptions import (
    PolarRequestValidationError,
    ResourceNotFound,
    Unauthorized,
)
from polar.models import Organization, OrganizationAccessToken, User
from polar.postgres import AsyncSession, get_db_session

ORGANIZATION_HEADER = "Polar-Organization-ID"

OrganizationHeader = Annotated[
    UUID | None,
    Header(
        alias=ORGANIZATION_HEADER,
        description=(
            "The organization to act on. Required for user credentials that "
            "are not already scoped to a single organization. Organization "
            "tokens always act on their own organization."
        ),
    ),
]


async def resolve(
    session: AsyncSession,
    auth_subject: AuthSubject[User | Organization],
    organization_id: UUID | None,
    permission: OrganizationPermission | None = None,
) -> AuthzContext[User | Organization]:
    if is_organization(auth_subject):
        if not isinstance(auth_subject.session, OrganizationAccessToken):
            raise Unauthorized()
        if organization_id is not None and organization_id != auth_subject.subject.id:
            raise ResourceNotFound()
        organization = auth_subject.subject
    elif is_user(auth_subject):
        selected = organization_id
        if selected is None:
            scoped = auth_subject.organization_ids
            if scoped is None or len(scoped) != 1:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "missing",
                            "loc": ("header", ORGANIZATION_HEADER),
                            "msg": (
                                f"The {ORGANIZATION_HEADER} header is required "
                                "with user credentials that can access more than "
                                "one organization."
                            ),
                            "input": None,
                        }
                    ]
                )
            selected = next(iter(scoped))
        accessible = await get_accessible_organization(session, auth_subject, selected)
        if accessible is None:
            raise ResourceNotFound()
        if permission is not None:
            await assert_organization_permission(
                session, auth_subject, accessible.id, permission
            )
        organization = accessible
    else:
        raise Unauthorized()

    if not organization.is_void_enabled:
        raise ResourceNotFound()
    return AuthzContext(organization=organization, auth_subject=auth_subject)


_VoidRead = Authenticator(
    allowed_subjects={User, Organization},
    required_scopes={Scope.void_read, Scope.void_write},
)
_VoidWrite = Authenticator(
    allowed_subjects={User, Organization},
    required_scopes={Scope.void_write},
)


async def _void_read(
    auth_subject: Annotated[AuthSubject[User | Organization], Depends(_VoidRead)],
    organization_id: OrganizationHeader = None,
    session: AsyncSession = Depends(get_db_session),
) -> AuthzContext[User | Organization]:
    return await resolve(session, auth_subject, organization_id)


async def _void_write(
    auth_subject: Annotated[AuthSubject[User | Organization], Depends(_VoidWrite)],
    organization_id: OrganizationHeader = None,
    session: AsyncSession = Depends(get_db_session),
) -> AuthzContext[User | Organization]:
    return await resolve(
        session,
        auth_subject,
        organization_id,
        OrganizationPermission.products_manage,
    )


VoidRead = Annotated[AuthzContext[User | Organization], Depends(_void_read)]
VoidWrite = Annotated[AuthzContext[User | Organization], Depends(_void_write)]


async def _void_customer_read(
    auth: VoidRead, _customer_auth_subject: CustomerRead
) -> AuthzContext[User | Organization]:
    return auth


async def _void_customer_write(
    auth: VoidWrite, _customer_auth_subject: CustomerWrite
) -> AuthzContext[User | Organization]:
    return auth


VoidCustomerRead = Annotated[
    AuthzContext[User | Organization], Depends(_void_customer_read)
]
VoidCustomerWrite = Annotated[
    AuthzContext[User | Organization], Depends(_void_customer_write)
]
