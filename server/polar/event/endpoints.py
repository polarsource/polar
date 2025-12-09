from collections.abc import Sequence
from datetime import date
from zoneinfo import ZoneInfo

from fastapi import Depends, Query
from fastapi.exceptions import RequestValidationError
from pydantic import UUID4, AwareDatetime, ValidationError
from pydantic_extra_types.timezone_name import TimeZoneName

from polar.customer.schemas.customer import CustomerID
from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import (
    ListResource,
    ListResourceWithCursorPagination,
    PaginationParamsQuery,
)
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.time_queries import TimeInterval, is_under_limits
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
    ListStatisticsTimeseries,
)
from .service import event as event_service

router = APIRouter(prefix="/events", tags=["events", APITag.public])


EventNotFound = {"description": "Event not found.", "model": ResourceNotFound.schema()}


@router.get(
    "/",
    summary="List Events",
    response_model=ListResource[EventSchema]
    | ListResourceWithCursorPagination[EventSchema],
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
    event_type_id: UUID4 | None = Query(
        None,
        title="Event Type ID Filter",
        description="Filter by event type ID.",
        include_in_schema=False,
    ),
    query: str | None = Query(
        None, title="Query", description="Query to filter events."
    ),
    parent_id: EventID | None = Query(
        None,
        description="When combined with depth, use this event as the anchor instead of root events.",
    ),
    depth: int | None = Query(
        None,
        ge=0,
        le=5,
        description="Fetch descendants up to this depth. When set: 0=root events only, 1=roots+children, etc. Max 5. When not set, returns all events.",
    ),
    aggregate_fields: Sequence[str] = Query(
        default=[],
        description="Metadata field paths to aggregate from descendants into ancestors (e.g., '_cost.amount', 'duration_ns'). Use dot notation for nested fields.",
        include_in_schema=False,
    ),
    cursor_pagination: bool = Query(
        False,
        title="Use cursor pagination",
        description="Use cursor-based pagination (has_next_page) instead of offset pagination. Faster for large datasets.",
        include_in_schema=False,
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[EventSchema] | ListResourceWithCursorPagination[EventSchema]:
    """List events."""

    # Manually parse the filter string to a Filter object as FastAPI does not
    # support complex schemas in query parameters.
    parsed_filter: Filter | None = None
    if filter is not None:
        try:
            parsed_filter = Filter.model_validate_json(filter)
        except ValidationError as e:
            raise RequestValidationError(e.errors()) from e

    if query is not None and organization_id is None:
        raise RequestValidationError(
            [
                {
                    "type": "query",
                    "msg": "Query is only supported when organization_id is provided.",
                }
            ]
        )

    result = await event_service.list(
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
        event_type_id=event_type_id,
        metadata=metadata,
        pagination=pagination,
        sorting=sorting,
        query=query,
        parent_id=parent_id,
        depth=depth,
        aggregate_fields=aggregate_fields,
        cursor_pagination=cursor_pagination,
    )

    results, count = result

    if cursor_pagination:
        return ListResourceWithCursorPagination.from_results(
            [EventTypeAdapter.validate_python(r) for r in results],
            count > 0,
        )

    return ListResource.from_paginated_results(
        [EventTypeAdapter.validate_python(r) for r in results],
        count,
        pagination,
    )


@router.get(
    "/statistics/timeseries",
    summary="List statistics timeseries",
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
    tags=[APITag.private],
    response_model=ListStatisticsTimeseries,
)
async def list_statistics_timeseries(
    auth_subject: auth.EventRead,
    metadata: MetadataQuery,
    hierarchy_sorting: sorting.EventStatisticsSorting,
    start_date: date = Query(
        ...,
        description="Start date.",
    ),
    end_date: date = Query(..., description="End date."),
    timezone: TimeZoneName = Query(
        default="UTC",
        description="Timezone to use for the dates. Default is UTC.",
    ),
    interval: TimeInterval = Query(..., description="Interval between two dates."),
    filter: str | None = Query(
        None,
        description=(
            "Filter events following filter clauses. "
            "JSON string following the same schema a meter filter clause. "
        ),
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
    event_type_id: UUID4 | None = Query(
        None,
        title="Event Type ID Filter",
        description="Filter by event type ID.",
    ),
    query: str | None = Query(
        None, title="Query", description="Query to filter events."
    ),
    aggregate_fields: Sequence[str] = Query(
        default=["_cost.amount"],
        description="Metadata field paths to aggregate (e.g., '_cost.amount', 'duration_ns'). Use dot notation for nested fields.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListStatisticsTimeseries:
    """
    Get aggregate statistics grouped by root event name over time.

    Returns time series data with periods and totals, similar to the metrics endpoint.
    Each period contains stats grouped by event name, and totals show overall stats
    across all periods.
    """
    # Validate interval limits
    if not is_under_limits(start_date, end_date, interval):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("query",),
                    "msg": (
                        "The interval is too big. "
                        "Try to change the interval or reduce the date range."
                    ),
                    "type": "value_error",
                    "input": (start_date, end_date, interval),
                }
            ]
        )

    # Parse filter if provided
    parsed_filter: Filter | None = None
    if filter is not None:
        try:
            parsed_filter = Filter.model_validate_json(filter)
        except ValidationError as e:
            raise RequestValidationError(e.errors()) from e

    if query is not None and organization_id is None:
        raise RequestValidationError(
            [
                {
                    "type": "query",
                    "msg": "Query is only supported when organization_id is provided.",
                }
            ]
        )

    return await event_service.list_statistics_timeseries(
        session,
        auth_subject,
        start_date=start_date,
        end_date=end_date,
        timezone=ZoneInfo(timezone),
        interval=interval,
        filter=parsed_filter,
        organization_id=organization_id,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        meter_id=meter_id,
        name=name,
        source=source,
        event_type_id=event_type_id,
        metadata=metadata,
        query=query,
        aggregate_fields=tuple(aggregate_fields),
        hierarchy_stats_sorting=hierarchy_sorting,
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
    aggregate_fields: Sequence[str] = Query(
        default=[],
        description="Metadata field paths to aggregate from descendants into ancestors (e.g., '_cost.amount', 'duration_ns'). Use dot notation for nested fields.",
        include_in_schema=False,
    ),
) -> Event:
    """Get an event by ID."""
    event = await event_service.get(
        session, auth_subject, id, aggregate_fields=aggregate_fields
    )

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
