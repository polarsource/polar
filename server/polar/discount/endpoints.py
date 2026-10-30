from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import SetSchemaReference
from polar.kit.versioning import version
from polar.models import Discount
from polar.openapi import APITag, cli_preview
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.version import V2027_01

from . import auth, legacy_schemas, sorting
from .schemas import Discount as DiscountSchema
from .schemas import (
    DiscountAdapter,
    DiscountCreate,
    DiscountListParams,
    DiscountUpdate,
)
from .service import discount as discount_service

router = APIRouter(
    prefix="/discounts", tags=["discounts", APITag.public, APITag.mcp, APITag.cli]
)


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
    filters: Annotated[DiscountListParams, Query()],
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[DiscountSchema]:
    """List discounts."""
    results, count = await discount_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        external_id=filters.external_id,
        query=filters.query,
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
    openapi_extra=cli_preview(
        ("id", "ID"),
        ("name", "Name"),
        ("code", "Code"),
        ("type", "Type"),
        ("duration", "Duration"),
    ),
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
    discount_create: Annotated[
        legacy_schemas.DiscountCreate,
        SetSchemaReference("DiscountCreate"),
    ],
    session: AsyncSession = Depends(get_db_session),
) -> Discount:
    """Create a discount."""
    return await discount_service.create(session, discount_create, auth_subject)


@router.post(
    "/",
    name="create",
    response_model=DiscountSchema,
    status_code=201,
    summary="Create Discount",
    responses={201: {"description": "Discount created."}},
)
@version(starting_from=V2027_01)
async def create_v2027_01(
    auth_subject: auth.DiscountWrite,
    discount_create: Annotated[
        DiscountCreate,
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
    discount_update: legacy_schemas.DiscountUpdate,
    auth_subject: auth.DiscountWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Discount:
    """Update a discount."""
    discount = await discount_service.get_by_id(session, auth_subject, id)

    if discount is None:
        raise ResourceNotFound()

    return await discount_service.update(
        session, discount, discount_update, auth_subject
    )


@router.patch(
    "/{id}",
    name="update",
    response_model=DiscountSchema,
    summary="Update Discount",
    responses={
        200: {"description": "Discount updated."},
        404: DiscountNotFound,
    },
)
@version(starting_from=V2027_01)
async def update_v2027_01(
    id: DiscountID,
    discount_update: DiscountUpdate,
    auth_subject: auth.DiscountWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Discount:
    """Update a discount."""
    discount = await discount_service.get_by_id(session, auth_subject, id)

    if discount is None:
        raise ResourceNotFound()

    return await discount_service.update(
        session, discount, discount_update, auth_subject
    )


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

    await discount_service.delete(session, discount, auth_subject)
