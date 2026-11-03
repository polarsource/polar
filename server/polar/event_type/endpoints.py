from typing import Annotated

from fastapi import Depends, Query

from polar.event_type import auth, schemas, sorting
from polar.event_type.service import event_type_service
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import EventTypeListParams

router = APIRouter(prefix="/event-types", tags=["event-types", APITag.public])


@router.get(
    "/",
    summary="List Event Types",
    response_model=ListResource[schemas.EventTypeWithStats],
    tags=[APITag.mcp, APITag.cli],
)
async def list(
    filters: Annotated[EventTypeListParams, Query()],
    auth_subject: auth.EventTypeRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.EventTypesSorting,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[schemas.EventTypeWithStats]:
    """List event types with aggregated statistics."""
    results, count = await event_type_service.list_with_stats(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        query=filters.query,
        root_events=filters.root_events,
        parent_id=filters.parent_id,
        source=filters.source,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(results, count, pagination)


@router.patch(
    "/{id}",
    response_model=schemas.EventType,
    summary="Update Event Type",
    tags=[APITag.mcp, APITag.cli],
    description="Update an event type's label.",
    status_code=200,
    responses={404: {}},
)
async def update(
    id: schemas.EventTypeID,
    body: schemas.EventTypeUpdate,
    auth_subject: auth.EventTypeWrite,
    session: AsyncSession = Depends(get_db_session),
) -> schemas.EventType:
    event_type = await event_type_service.get(session, auth_subject, id)
    if event_type is None:
        raise ResourceNotFound()

    updated_event_type = await event_type_service.update(
        session,
        event_type,
        body.label,
        auth_subject,
        label_property_selector=body.label_property_selector,
    )
    return schemas.EventType.model_validate(updated_event_type)
