from uuid import UUID

import structlog
from fastapi import Depends

from polar.auth.models import is_member
from polar.exceptions import NotPermitted
from polar.member.service import member_service
from polar.models.customer import CustomerType
from polar.models.member import Member
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.member import (
    CustomerPortalMember,
    CustomerPortalMemberCreate,
    CustomerPortalMemberUpdate,
)
from ..utils import get_customer

log = structlog.get_logger()

router = APIRouter(prefix="/members", tags=["members", APITag.public])


def _require_team_customer(auth_subject: auth.CustomerPortalBillingManager) -> None:
    """Validate that the customer is a team customer."""
    customer = get_customer(auth_subject)
    if customer.type != CustomerType.team:
        raise NotPermitted(
            "Member management is only available for team customers. "
            "Purchase a seat-based product to enable team features."
        )


@router.get(
    "",
    summary="List Members",
    response_model=list[CustomerPortalMember],
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted - requires owner or billing manager role"},
    },
)
async def list_members(
    auth_subject: auth.CustomerPortalBillingManager,
    session: AsyncSession = Depends(get_db_session),
) -> list[Member]:
    """
    List all members of the customer's team.

    Only available to owners and billing managers of team customers.
    """
    _require_team_customer(auth_subject)
    customer = get_customer(auth_subject)

    members = await member_service.list_by_customer(session, customer.id)

    log.info(
        "customer_portal.members.list",
        customer_id=customer.id,
        member_count=len(members),
        actor_member_id=auth_subject.subject.id if is_member(auth_subject) else None,
    )

    return list(members)


@router.post(
    "",
    summary="Add Member",
    response_model=CustomerPortalMember,
    status_code=201,
    responses={
        201: {"description": "Member added."},
        400: {"description": "Invalid request or member already exists."},
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted - requires owner or billing manager role"},
    },
)
async def add_member(
    member_create: CustomerPortalMemberCreate,
    auth_subject: auth.CustomerPortalBillingManager,
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """
    Add a new member to the customer's team.

    Only available to owners and billing managers of team customers.

    Rules:
    - Cannot add a member with the owner role (there must be exactly one owner)
    - If a member with this email already exists, the existing member is returned
    """
    _require_team_customer(auth_subject)
    customer = get_customer(auth_subject)
    actor_member = auth_subject.subject

    return await member_service.customer_portal_add_member(
        session,
        customer,
        actor_member,
        email=member_create.email,
        name=member_create.name,
        role=member_create.role,
    )


@router.patch(
    "/{id}",
    summary="Update Member",
    response_model=CustomerPortalMember,
    responses={
        200: {"description": "Member updated."},
        400: {"description": "Invalid role change."},
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted - requires owner or billing manager role"},
        404: {"description": "Member not found."},
    },
)
async def update_member(
    id: UUID,
    member_update: CustomerPortalMemberUpdate,
    auth_subject: auth.CustomerPortalBillingManager,
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """
    Update a member's role.

    Only available to owners and billing managers of team customers.

    Rules:
    - Cannot modify your own role (to prevent self-demotion)
    - Customer must have exactly one owner at all times
    """
    _require_team_customer(auth_subject)
    customer = get_customer(auth_subject)
    actor_member = auth_subject.subject

    return await member_service.customer_portal_update_member(
        session,
        customer,
        actor_member,
        id,
        role=member_update.role,
    )


@router.delete(
    "/{id}",
    status_code=204,
    summary="Remove Member",
    responses={
        204: {"description": "Member removed."},
        400: {"description": "Cannot remove the only owner."},
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted - requires owner or billing manager role"},
        404: {"description": "Member not found."},
    },
)
async def remove_member(
    id: UUID,
    auth_subject: auth.CustomerPortalBillingManager,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Remove a member from the team.

    Only available to owners and billing managers of team customers.

    Rules:
    - Cannot remove yourself
    - Cannot remove the only owner
    """
    _require_team_customer(auth_subject)
    customer = get_customer(auth_subject)
    actor_member = auth_subject.subject

    await member_service.customer_portal_remove_member(
        session,
        customer,
        actor_member,
        id,
    )
