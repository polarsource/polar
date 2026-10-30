from collections.abc import Sequence
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Query
from fastapi.exceptions import RequestValidationError
from pydantic import UUID4, ValidationError

from polar.exceptions import (
    NotPermitted,
    PolarRequestValidationError,
    ResourceNotFound,
)
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import (
    ListResource,
    ListResourceWithCursorPagination,
    PaginationParamsQuery,
)
from polar.kit.time_queries import is_under_limits
from polar.kit.versioning import version
from polar.meter.filter import Filter
from polar.models import Event
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter
from polar.version import V2027_01

from . import auth, sorting
from .schemas import (
    AggregateField,
    EventID,
    EventListNamesParams,
    EventListParams,
    EventListStatisticsTimeseriesParams,
    EventName,
    EventsIngest,
    EventsIngestResponse,
    EventStatisticsByPropertyParams,
    EventStatisticsByVarianceParams,
    EventStatisticsParams,
    EventTypeAdapter,
    ListCustomerStats,
    ListPropertyGroupStats,
    ListStatisticsTimeseries,
    ListVarianceEvents,
)
from .schemas import Event as EventSchema
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
    filters: Annotated[EventListParams, Query()],
    auth_subject: auth.EventRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    metadata: MetadataQuery,
    event_type_id: UUID4 | None = Query(
        None,
        title="Event Type ID Filter",
        description="Filter by event type ID.",
        include_in_schema=False,
    ),
    aggregate_fields: Sequence[AggregateField] = Query(
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
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[EventSchema] | ListResourceWithCursorPagination[EventSchema]:
    """List events."""

    # Manually parse the filter string to a Filter object as FastAPI does not
    # support complex schemas in query parameters.
    parsed_filter: Filter | None = None
    if filters.filter is not None:
        try:
            parsed_filter = Filter.model_validate_json(filters.filter)
        except ValidationError as e:
            raise RequestValidationError(e.errors()) from e

    if filters.query is not None and filters.organization_id is None:
        raise RequestValidationError(
            [
                {
                    "type": "value_error",
                    "msg": "Query is only supported when organization_id is provided.",
                    "loc": ("query", "query"),
                    "input": filters.query,
                }
            ]
        )

    if filters.query is not None and len(filters.query) < 3:
        raise RequestValidationError(
            [
                {
                    "type": "query",
                    "msg": "Query must be at least 3 characters.",
                    "loc": ("query", "query"),
                    "input": filters.query,
                }
            ]
        )

    result = await event_service.list(
        session,
        auth_subject,
        filter=parsed_filter,
        start_timestamp=filters.start_timestamp,
        end_timestamp=filters.end_timestamp,
        organization_id=filters.organization_id,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        meter_id=filters.meter_id,
        name=filters.name,
        source=filters.source,
        event_type_id=event_type_id,
        metadata=metadata,
        pagination=pagination,
        sorting=sorting,
        query=filters.query,
        parent_id=filters.parent_id,
        depth=filters.depth,
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
    "/statistics/by-property",
    summary="Get statistics grouped by property",
    tags=[APITag.private],
    response_model=ListPropertyGroupStats,
)
async def get_statistics_by_property(
    filters: Annotated[EventStatisticsByPropertyParams, Query()],
    auth_subject: auth.EventRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListPropertyGroupStats:
    """
    Get aggregate statistics grouped by distinct values of a metadata property.

    Useful for ranking LLM models, vendors, or other metadata dimensions by cost.
    """
    return await event_service.list_property_group_stats(
        session,
        auth_subject,
        property=filters.property,
        start_date=filters.start_date,
        end_date=filters.end_date,
        timezone=ZoneInfo(filters.timezone),
        organization_id=filters.organization_id,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        aggregate_fields=tuple(filters.aggregate_fields),
        limit=filters.limit,
    )


@router.get(
    "/statistics/by-customer",
    summary="Get statistics ranked by customer",
    tags=[APITag.private],
    response_model=ListCustomerStats,
)
async def get_statistics_by_customer(
    filters: Annotated[EventStatisticsParams, Query()],
    auth_subject: auth.EventRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListCustomerStats:
    """
    Get aggregate statistics ranked by customer.

    Returns customers ordered by the primary aggregate field (default `_cost.amount`)
    descending, summed across all their root events in the time range.
    """
    return await event_service.list_customer_stats(
        session,
        auth_subject,
        start_date=filters.start_date,
        end_date=filters.end_date,
        timezone=ZoneInfo(filters.timezone),
        organization_id=filters.organization_id,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        aggregate_fields=tuple(filters.aggregate_fields),
        limit=filters.limit,
    )


@router.get(
    "/statistics/by-variance",
    summary="Get high-variance root events",
    tags=[APITag.private],
    response_model=ListVarianceEvents,
)
async def get_statistics_by_variance(
    filters: Annotated[EventStatisticsByVarianceParams, Query()],
    auth_subject: auth.EventRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListVarianceEvents:
    """
    Get root events whose aggregate value is at or above the p99 for their event name.

    Returns individual traces that are outliers compared to the typical distribution,
    ordered by value descending. Useful for identifying anomalous or expensive runs.
    """
    return await event_service.list_variance_events(
        session,
        auth_subject,
        start_date=filters.start_date,
        end_date=filters.end_date,
        timezone=ZoneInfo(filters.timezone),
        organization_id=filters.organization_id,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        name=filters.name,
        aggregate_fields=tuple(filters.aggregate_fields),
        limit=filters.limit,
    )


@router.get(
    "/statistics/timeseries",
    summary="List statistics timeseries",
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
    tags=[APITag.private],
    response_model=ListStatisticsTimeseries,
)
async def list_statistics_timeseries(
    filters: Annotated[EventListStatisticsTimeseriesParams, Query()],
    auth_subject: auth.EventRead,
    metadata: MetadataQuery,
    hierarchy_sorting: sorting.EventStatisticsSorting,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListStatisticsTimeseries:
    """
    Get aggregate statistics grouped by root event name over time.

    Returns time series data with periods and totals, similar to the metrics endpoint.
    Each period contains stats grouped by event name, and totals show overall stats
    across all periods.
    """
    # Validate interval limits
    if not is_under_limits(filters.start_date, filters.end_date, filters.interval):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("query",),
                    "msg": (
                        "The interval is too small for the given date range. "
                        "Use a larger interval or reduce the date range."
                    ),
                    "type": "value_error",
                    "input": (filters.start_date, filters.end_date, filters.interval),
                }
            ]
        )

    # Parse filter if provided
    parsed_filter: Filter | None = None
    if filters.filter is not None:
        try:
            parsed_filter = Filter.model_validate_json(filters.filter)
        except ValidationError as e:
            raise RequestValidationError(e.errors()) from e

    if filters.query is not None and filters.organization_id is None:
        raise RequestValidationError(
            [
                {
                    "type": "value_error",
                    "msg": "Query is only supported when organization_id is provided.",
                    "loc": ("query", "query"),
                    "input": filters.query,
                }
            ]
        )

    if filters.query is not None and len(filters.query) < 3:
        raise RequestValidationError(
            [
                {
                    "type": "query",
                    "msg": "Query must be at least 3 characters.",
                    "loc": ("query", "query"),
                    "input": filters.query,
                }
            ]
        )

    return await event_service.list_statistics_timeseries(
        session,
        auth_subject,
        start_date=filters.start_date,
        end_date=filters.end_date,
        timezone=ZoneInfo(filters.timezone),
        interval=filters.interval,
        filter=parsed_filter,
        organization_id=filters.organization_id,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        meter_id=filters.meter_id,
        name=filters.name,
        source=filters.source,
        event_type_id=filters.event_type_id,
        metadata=metadata,
        query=filters.query,
        aggregate_fields=tuple(filters.aggregate_fields),
        hierarchy_stats_sorting=hierarchy_sorting,
    )


@router.get(
    "/names",
    summary="List Event Names",
    response_model=ListResource[EventName],
    tags=[APITag.mcp, APITag.cli],
)
async def list_names(
    filters: Annotated[EventListNamesParams, Query()],
    auth_subject: auth.EventNamesRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.EventNamesSorting,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[EventName]:
    """List event names."""
    results, count = await event_service.list_names(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        source=filters.source,
        query=filters.query,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(results, count, pagination)


@router.get(
    "/{id}",
    summary="Get Event",
    response_model=EventSchema,
    tags=[APITag.mcp, APITag.cli],
    responses={404: EventNotFound},
)
async def get(
    id: EventID,
    auth_subject: auth.EventRead,
    session: AsyncReadSession = Depends(get_db_read_session),
    aggregate_fields: Sequence[AggregateField] = Query(
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
    redis: Redis = Depends(get_redis),
) -> EventsIngestResponse:
    """Ingest batch of events."""
    return await event_service.ingest(session, auth_subject, ingest, redis=redis)


@router.post(
    "/ingest",
    name="ingest",
    summary="Ingest Events",
    responses={403: {"model": NotPermitted.schema()}},
)
@version(starting_from=V2027_01)
async def ingest_v2027_01(
    ingest: EventsIngest,
    auth_subject: auth.EventWriteSingleOrganization,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> EventsIngestResponse:
    """Ingest batch of events."""
    return await event_service.ingest(session, auth_subject, ingest, redis=redis)
