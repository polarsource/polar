from fastapi import Depends, Query
from fastapi.exceptions import RequestValidationError
from pydantic import AwareDatetime, ValidationError

from polar.customer.schemas.customer import CustomerID
from polar.exceptions import ResourceNotFound
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.meter.filter import Filter
from polar.meter.schemas import MeterID
from polar.models import Event
from polar.models.event import EventSource
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Event as EventSchema
from .schemas import (
    EventID,
    EventName,
    EventsIngest,
    EventsIngestResponse,
    EventTypeAdapter,
)
from .service import event as event_service

router = APIRouter(
    prefix="/events", tags=["events", APITag.documented, APITag.featured]
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
    filter: str | None = Query(
        None,
        description=(
            "Filter events following filter clauses. "
            "JSON string following the same schema a meter filter clause. "
        ),
    ),
    start_timestamp: AwareDatetime | None = Query(
        None, description="Filter events after this timestamp."
    ),
    end_timestamp: AwareDatetime | None = Query(
        None, description="Filter events before this timestamp."
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
    meter_id: MeterID | None = Query(
        None, title="MeterID Filter", description="Filter by a meter filter clause."
    ),
    name: MultipleQueryFilter[str] | None = Query(
        None, title="Name Filter", description="Filter by event name."
    ),
    source: MultipleQueryFilter[EventSource] | None = Query(
        None, title="Source Filter", description="Filter by event source."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[EventSchema]:
    """List events."""

    # Manually parse the filter string to a Filter object as FastAPI does not
    # support complex schemas in query parameters.
    parsed_filter: Filter | None = None
    if filter is not None:
        try:
            parsed_filter = Filter.parse_raw(filter)
        except ValidationError as e:
            raise RequestValidationError(e.errors()) from e

    results, count = await event_service.list(
        session,
        auth_subject,
        filter=parsed_filter,
        start_timestamp=start_timestamp,
        end_timestamp=end_timestamp,
        organization_id=organization_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        meter_id=meter_id,
        name=name,
        source=source,
        metadata=metadata,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [EventTypeAdapter.validate_python(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/names", summary="List Event Names", response_model=ListResource[EventName]
)
async def list_names(
    auth_subject: auth.EventRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.EventNamesSorting,
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
    source: MultipleQueryFilter[EventSource] | None = Query(
        None, title="Source Filter", description="Filter by event source."
    ),
    query: str | None = Query(
        None, title="Query", description="Query to filter event names."
    ),
) -> ListResource[EventName]:
    """List event names."""
    results, count = await event_service.list_names(
        session,
        auth_subject,
        organization_id=organization_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        source=source,
        query=query,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(results, count, pagination)


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
