from uuid import UUID

import structlog
from fastapi import Depends

from polar.auth.models import is_member
from polar.exceptions import NotPermitted, PolarRequestValidationError, ResourceNotFound
from polar.member.repository import MemberRepository
from polar.models.customer import CustomerType
from polar.models.member import Member, MemberRole
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

MemberNotFound = {
    "description": "Member not found.",
    "model": ResourceNotFound.schema(),
}


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

    repository = MemberRepository.from_session(session)
    members = await repository.list_by_customer(session, customer.id)

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

    repository = MemberRepository.from_session(session)

    # Prevent adding a new owner - there must be exactly one
    if member_create.role == MemberRole.owner:
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body", "role"),
                    "msg": "Cannot add a member as owner. There must be exactly one owner.",
                    "input": member_create.role,
                }
            ]
        )

    # Check if member already exists
    existing_member = await repository.get_by_customer_id_and_email(
        customer.id, member_create.email
    )
    if existing_member:
        log.info(
            "customer_portal.members.add.already_exists",
            customer_id=customer.id,
            email=member_create.email,
            existing_member_id=existing_member.id,
            actor_member_id=actor_member.id,
        )
        return existing_member

    # Create the new member
    member = Member(
        customer_id=customer.id,
        organization_id=customer.organization_id,
        email=member_create.email,
        name=member_create.name,
        role=member_create.role,
    )

    created_member = await repository.create(member, flush=True)

    log.info(
        "customer_portal.members.add",
        customer_id=customer.id,
        member_id=created_member.id,
        email=member_create.email,
        role=member_create.role,
        actor_member_id=actor_member.id,
    )

    return created_member


@router.patch(
    "/{id}",
    summary="Update Member",
    response_model=CustomerPortalMember,
    responses={
        200: {"description": "Member updated."},
        400: {"description": "Invalid role change."},
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted - requires owner or billing manager role"},
        404: MemberNotFound,
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

    repository = MemberRepository.from_session(session)

    # Fetch the member to update
    members = await repository.list_by_customer(session, customer.id)
    member = next((m for m in members if m.id == id), None)

    if member is None:
        raise ResourceNotFound("Member not found")

    # Prevent self-modification
    if member.id == actor_member.id:
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("path", "id"),
                    "msg": "You cannot modify your own role.",
                    "input": str(id),
                }
            ]
        )

    # Check if role change is valid
    new_role = member_update.role
    if member.role != new_role:
        owner_count = sum(1 for m in members if m.role == MemberRole.owner)

        # Demoting the only owner
        if member.role == MemberRole.owner and new_role != MemberRole.owner:
            if owner_count <= 1:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "role"),
                            "msg": "Cannot demote the only owner. The team must have at least one owner.",
                            "input": new_role,
                        }
                    ]
                )

        # Promoting to owner when there's already an owner
        if new_role == MemberRole.owner and member.role != MemberRole.owner:
            if owner_count >= 1:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "role"),
                            "msg": "Cannot have multiple owners. Demote the current owner first.",
                            "input": new_role,
                        }
                    ]
                )

    # Update the member
    updated_member = await repository.update(member, update_dict={"role": new_role})

    log.info(
        "customer_portal.members.update",
        customer_id=customer.id,
        member_id=member.id,
        actor_member_id=actor_member.id,
        old_role=member.role,
        new_role=new_role,
    )

    return updated_member


@router.delete(
    "/{id}",
    status_code=204,
    summary="Remove Member",
    responses={
        204: {"description": "Member removed."},
        400: {"description": "Cannot remove the only owner."},
        401: {"description": "Authentication required"},
        403: {"description": "Not permitted - requires owner or billing manager role"},
        404: MemberNotFound,
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

    repository = MemberRepository.from_session(session)

    # Fetch all members
    members = await repository.list_by_customer(session, customer.id)
    member = next((m for m in members if m.id == id), None)

    if member is None:
        raise ResourceNotFound("Member not found")

    # Prevent self-removal
    if member.id == actor_member.id:
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("path", "id"),
                    "msg": "You cannot remove yourself from the team.",
                    "input": str(id),
                }
            ]
        )

    # Prevent removing the only owner
    if member.role == MemberRole.owner:
        owner_count = sum(1 for m in members if m.role == MemberRole.owner)
        if owner_count <= 1:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("path", "id"),
                        "msg": "Cannot remove the only owner. Transfer ownership first.",
                        "input": str(id),
                    }
                ]
            )

    # Soft delete the member
    await repository.soft_delete(member)

    log.info(
        "customer_portal.members.remove",
        customer_id=customer.id,
        member_id=member.id,
        member_role=member.role,
        actor_member_id=actor_member.id,
    )
