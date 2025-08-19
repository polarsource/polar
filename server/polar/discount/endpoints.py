from typing import Annotated

from fastapi import Body, Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter, SetSchemaReference
from polar.models import Discount
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Discount as DiscountSchema
from .schemas import (
    DiscountAdapter,
    DiscountCreate,
    DiscountUpdate,
)
from .service import discount as discount_service

router = APIRouter(prefix="/discounts", tags=["discounts", APITag.public])


DiscountID = Annotated[UUID4, Path(description="The discount ID.")]
DiscountNotFound = {
    "description": "Discount not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", summary="List Discounts", response_model=ListResource[DiscountSchema])
async def list(
    auth_subject: auth.DiscountRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    query: str | None = Query(None, description="Filter by name."),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[DiscountSchema]:
    """List discounts."""
    results, count = await discount_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        query=query,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [DiscountAdapter.validate_python(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Discount",
    response_model=DiscountSchema,
    responses={404: DiscountNotFound},
)
async def get(
    id: DiscountID,
    auth_subject: auth.DiscountRead,
    session: AsyncSession = Depends(get_db_session),
) -> Discount:
    """Get a discount by ID."""
    discount = await discount_service.get_by_id(session, auth_subject, id)

    if discount is None:
        raise ResourceNotFound()

    return discount


@router.post(
    "/",
    response_model=DiscountSchema,
    status_code=201,
    summary="Create Discount",
    responses={201: {"description": "Discount created."}},
)
async def create(
    auth_subject: auth.DiscountWrite,
    # This is a workaround for FastAPI bug: https://github.com/fastapi/fastapi/discussions/12941
    discount_create: Annotated[
        DiscountCreate,
        Body(...),
        SetSchemaReference("DiscountCreate"),
    ],
    session: AsyncSession = Depends(get_db_session),
) -> Discount:
    """Create a discount."""
    return await discount_service.create(session, discount_create, auth_subject)


@router.patch(
    "/{id}",
    response_model=DiscountSchema,
    summary="Update Discount",
    responses={
        200: {"description": "Discount updated."},
        404: DiscountNotFound,
    },
)
async def update(
    id: DiscountID,
    discount_update: DiscountUpdate,
    auth_subject: auth.DiscountWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Discount:
    """Update a discount."""
    discount = await discount_service.get_by_id(session, auth_subject, id)

    if discount is None:
        raise ResourceNotFound()

    return await discount_service.update(session, discount, discount_update)


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete Discount",
    responses={
        204: {"description": "Discount deleted."},
        404: DiscountNotFound,
    },
)
async def delete(
    id: DiscountID,
    auth_subject: auth.DiscountWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a discount."""
    discount = await discount_service.get_by_id(session, auth_subject, id)

    if discount is None:
        raise ResourceNotFound()

    await discount_service.delete(session, discount)
