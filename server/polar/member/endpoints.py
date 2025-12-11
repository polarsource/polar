from typing import Annotated
from uuid import UUID

from fastapi import Depends, Path, Query
from pydantic import UUID4

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
from .schemas import Member
from .service import member_service

router = APIRouter(
    prefix="/members",
    tags=["members", APITag.public, APITag.mcp],
)

MemberID = Annotated[UUID4, Path(description="The member ID.")]
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


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete Member",
    responses={
        204: {"description": "Member deleted."},
        404: MemberNotFound,
    },
)
async def delete(
    id: MemberID,
    auth_subject: auth.MemberWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a member."""
    member = await member_service.get_by_id(session, auth_subject, id)

    if member is None:
        raise ResourceNotFound()

    await member_service.delete(session, member)
