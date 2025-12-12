from uuid import UUID

from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Member, MemberCreate
from .service import member_service

router = APIRouter(
    prefix="/members",
    tags=["members", APITag.public, APITag.mcp],
)

MemberNotFound = {
    "description": "Member not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Members",
    response_model=ListResource[Member],
)
async def list_members(
    auth_subject: auth.MemberRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    customer_id: str | None = Query(None, description="Filter by customer ID."),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[Member]:
    """List members with optional customer ID filter."""
    parsed_customer_id = None
    if customer_id is not None:
        try:
            parsed_customer_id = UUID(customer_id)
        except ValueError:
            raise ResourceNotFound("Invalid customer ID format")

    results, count = await member_service.list(
        session,
        auth_subject,
        customer_id=parsed_customer_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [Member.model_validate(member) for member in results],
        count,
        pagination,
    )


@router.post(
    "/",
    response_model=Member,
    status_code=201,
    summary="Create Member",
    responses={
        201: {"description": "Member created."},
        403: {"description": "Not permitted to add members."},
        404: MemberNotFound,
    },
)
async def create_member(
    member_create: MemberCreate,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Member:
    """
    Create a new member for a customer.

    Only B2B customers with the member management feature enabled can add members.
    The authenticated user or organization must have access to the customer's organization.
    """
    created_member = await member_service.create(
        session,
        auth_subject,
        customer_id=member_create.customer_id,
        email=member_create.email,
        name=member_create.name,
        external_id=member_create.external_id,
        role=member_create.role,
    )

    return Member.model_validate(created_member)


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete Member",
    responses={
        204: {"description": "Member deleted."},
        404: MemberNotFound,
    },
)
async def delete_member(
    id: UUID,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Delete a member.

    The authenticated user or organization must have access to the member's organization.
    """
    member = await member_service.get(session, auth_subject, id)

    if member is None:
        raise ResourceNotFound("Member not found")

    await member_service.delete(session, member)
