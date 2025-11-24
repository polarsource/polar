from uuid import UUID

from fastapi import Depends, Query

from polar.customer.schemas.customer import CustomerID
from polar.event_type import auth, schemas, sorting
from polar.event_type.service import event_type_service
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models.event import EventSource
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

router = APIRouter(prefix="/event-types", tags=["event-types", APITag.public])


@router.get(
    "/",
    summary="List Event Types",
    response_model=ListResource[schemas.EventTypeWithStats],
)
async def list(
    auth_subject: auth.EventTypeRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.EventTypesSorting,
    session: AsyncSession = Depends(get_db_session),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    external_customer_id: MultipleQueryFilter[str] | None = Query(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by external customer ID.",
    ),
    query: str | None = Query(
        None,
        title="Query",
        description="Query to filter event types by name or label.",
    ),
    root_events: bool = Query(
        False,
        title="Root Events Filter",
        description="When true, only return event types with root events (parent_id IS NULL).",
    ),
    parent_id: UUID | None = Query(
        None,
        title="ParentID Filter",
        description="Filter by specific parent event ID.",
    ),
    source: EventSource | None = Query(
        None,
        title="EventSource Filter",
        description="Filter by event source (system or user).",
    ),
) -> ListResource[schemas.EventTypeWithStats]:
    """List event types with aggregated statistics."""
    results, count = await event_type_service.list_with_stats(
        session,
        auth_subject,
        organization_id=organization_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        query=query,
        root_events=root_events,
        parent_id=parent_id,
        source=source,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(results, count, pagination)


@router.patch(
    "/{id}",
    response_model=schemas.EventType,
    summary="Update Event Type",
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
        session, event_type, body.label, body.label_property_selector
    )
    return schemas.EventType.model_validate(updated_event_type)
