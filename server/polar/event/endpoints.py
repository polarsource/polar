from fastapi import Depends, Query
from pydantic import AwareDatetime

from polar.customer.schemas import CustomerID
from polar.exceptions import ResourceNotFound
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Event
from polar.models.event import EventSource
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Event as EventSchema
from .schemas import EventID, EventsIngest, EventsIngestResponse
from .service import event as event_service

router = APIRouter(
    prefix="/events",
    tags=[
        "events",
        APITag.private,
        # APITag.documented, APITag.featured, # Make it private for now, not ready for the show yet
    ],
)


EventNotFound = {"description": "Event not found.", "model": ResourceNotFound.schema()}


@router.get(
    "/",
    summary="List Events",
    response_model=ListResource[EventSchema],
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def list(
    auth_subject: auth.EventRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    metadata: MetadataQuery,
    before: AwareDatetime | None = Query(
        None, description="Filter events before this timestamp."
    ),
    after: AwareDatetime | None = Query(
        None, description="Filter events after this timestamp."
    ),
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
    source: MultipleQueryFilter[EventSource] | None = Query(
        None, title="Source Filter", description="Filter by event source."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[EventSchema]:
    """List events."""
    results, count = await event_service.list(
        session,
        auth_subject,
        before=before,
        after=after,
        organization_id=organization_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        source=source,
        metadata=metadata,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [EventSchema.model_validate(result) for result in results], count, pagination
    )


@router.get(
    "/{id}",
    summary="Get Event",
    response_model=EventSchema,
    responses={404: EventNotFound},
)
async def get(
    id: EventID,
    auth_subject: auth.EventRead,
    session: AsyncSession = Depends(get_db_session),
) -> Event:
    """Get an event by ID."""
    event = await event_service.get(session, auth_subject, id)

    if event is None:
        raise ResourceNotFound()

    return event


@router.post("/ingest", summary="Ingest Events")
async def ingest(
    ingest: EventsIngest,
    auth_subject: auth.EventWrite,
    session: AsyncSession = Depends(get_db_session),
) -> EventsIngestResponse:
    """Ingest batch of events."""
    return await event_service.ingest(session, auth_subject, ingest)
