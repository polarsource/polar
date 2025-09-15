from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import CustomField
from polar.models.custom_field import CustomFieldType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import CustomField as CustomFieldSchema
from .schemas import CustomFieldAdapter, CustomFieldCreate, CustomFieldUpdate
from .service import custom_field as custom_field_service

router = APIRouter(prefix="/custom-fields", tags=["custom-fields", APITag.public])


CustomFieldID = Annotated[UUID4, Path(description="The custom field ID.")]
CustomFieldNotFound = {
    "description": "Custom field not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/", summary="List Custom Fields", response_model=ListResource[CustomFieldSchema]
)
async def list(
    auth_subject: auth.CustomFieldRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    query: str | None = Query(None, description="Filter by custom field name or slug."),
    type: MultipleQueryFilter[CustomFieldType] | None = Query(
        None, title="CustomFieldType Filter", description="Filter by custom field type."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CustomFieldSchema]:
    """List custom fields."""
    results, count = await custom_field_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        query=query,
        type=type,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CustomFieldAdapter.validate_python(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Custom Field",
    response_model=CustomFieldSchema,
    responses={404: CustomFieldNotFound},
)
async def get(
    id: CustomFieldID,
    auth_subject: auth.CustomFieldRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CustomField:
    """Get a custom field by ID."""
    custom_field = await custom_field_service.get_by_id(session, auth_subject, id)

    if custom_field is None:
        raise ResourceNotFound()

    return custom_field


@router.post(
    "/",
    response_model=CustomFieldSchema,
    status_code=201,
    summary="Create Custom Field",
    responses={201: {"description": "Custom field created."}},
)
async def create(
    custom_field_create: CustomFieldCreate,
    auth_subject: auth.CustomFieldWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomField:
    """Create a custom field."""
    return await custom_field_service.create(session, custom_field_create, auth_subject)


@router.patch(
    "/{id}",
    response_model=CustomFieldSchema,
    summary="Update Custom Field",
    responses={
        200: {"description": "Custom field updated."},
        404: CustomFieldNotFound,
    },
)
async def update(
    id: CustomFieldID,
    custom_field_update: CustomFieldUpdate,
    auth_subject: auth.CustomFieldWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomField:
    """Update a custom field."""
    custom_field = await custom_field_service.get_by_id(session, auth_subject, id)

    if custom_field is None:
        raise ResourceNotFound()

    return await custom_field_service.update(session, custom_field, custom_field_update)


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete Custom Field",
    responses={
        204: {"description": "Custom field deleted."},
        404: CustomFieldNotFound,
    },
)
async def delete(
    id: CustomFieldID,
    auth_subject: auth.CustomFieldWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a custom field."""
    custom_field = await custom_field_service.get_by_id(session, auth_subject, id)

    if custom_field is None:
        raise ResourceNotFound()

    await custom_field_service.delete(session, custom_field)
