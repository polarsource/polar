import uuid
from collections import defaultdict, deque
from collections.abc import Callable, Mapping, Sequence
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

import logfire
import structlog
from opentelemetry import trace
from sqlalchemy import (
    Select,
    String,
    UnaryExpression,
    asc,
    cast,
    desc,
    func,
    or_,
    select,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_meter.repository import CustomerMeterRepository
from polar.event.tinybird_repository import TinybirdEventRepository
from polar.event_type.repository import EventTypeRepository
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.integrations.tinybird.service import (
    TinybirdTimeseriesBucket,
    ingest_events,
)
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.member.repository import MemberRepository
from polar.meter.aggregation import PropertyAggregation
from polar.meter.filter import Filter
from polar.meter.repository import MeterRepository
from polar.models import (
    Customer,
    CustomerMeter,
    Event,
    EventClosure,
    Meter,
    MeterEvent,
    Organization,
    User,
    UserOrganization,
)
from polar.models.event import EventSource
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from polar.worker import enqueue_events, enqueue_job

from .repository import EventRepository
from .schemas import (
    EventCreateCustomer,
    EventName,
    EventsIngest,
    EventsIngestResponse,
    EventStatistics,
    ListStatisticsTimeseries,
    StatisticsPeriod,
)
from .sorting import EventNamesSortProperty, EventSortProperty
from .system import SystemEvent

log: Logger = structlog.get_logger()


class EventError(PolarError): ...


class EventIngestValidationError(EventError):
    def __init__(self, errors: list[ValidationError]) -> None:
        self.errors = errors
        super().__init__("Event ingest validation failed.")


def _topological_sort_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Sort events by dependency order so parents come before children.
    Events without parents come first, followed by their children in order.

    Handles parent_id references that can be either Polar IDs or external_id strings.
    Uses Kahn's algorithm for topological sorting.
    """
    if not events:
        return []

    id_to_index: dict[uuid.UUID | str, int] = {}
    for idx, event in enumerate(events):
        if "id" in event:
            id_to_index[event["id"]] = idx
        if "external_id" in event and event["external_id"] is not None:
            id_to_index[event["external_id"]] = idx

    graph: dict[int, list[int]] = defaultdict(list)
    in_degree: dict[int, int] = {}

    for idx in range(len(events)):
        in_degree[idx] = 0

    for idx, event in enumerate(events):
        parent_id = event.get("parent_id")
        if parent_id and parent_id in id_to_index:
            parent_idx = id_to_index[parent_id]
            graph[parent_idx].append(idx)
            in_degree[idx] += 1

    queue = deque(idx for idx in range(len(events)) if in_degree[idx] == 0)
    sorted_indices: list[int] = []

    while queue:
        current_idx = queue.popleft()
        sorted_indices.append(current_idx)

        for child_idx in graph[current_idx]:
            in_degree[child_idx] -= 1
            if in_degree[child_idx] == 0:
                queue.append(child_idx)

    if len(sorted_indices) != len(events):
        raise EventError("Circular dependency detected in event parent relationships")

    return [events[idx] for idx in sorted_indices]


class EventService:
    async def _build_filtered_statement(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        repository: EventRepository,
        *,
        filter: Filter | None = None,
        start_timestamp: datetime | None = None,
        end_timestamp: datetime | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        meter_id: uuid.UUID | None = None,
        name: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        event_type_id: uuid.UUID | None = None,
        metadata: MetadataQuery | None = None,
        sorting: Sequence[Sorting[EventSortProperty]] = (
            (EventSortProperty.timestamp, True),
        ),
        query: str | None = None,
    ) -> Select[tuple[Event]]:
        statement = repository.get_readable_statement(auth_subject).options(
            *repository.get_eager_options()
        )

        if filter is not None:
            statement = statement.where(filter.get_sql_clause(Event))

        if start_timestamp is not None:
            statement = statement.where(Event.timestamp > start_timestamp)

        if end_timestamp is not None:
            statement = statement.where(Event.timestamp < end_timestamp)

        if organization_id is not None:
            statement = statement.where(Event.organization_id.in_(organization_id))

        if customer_id is not None:
            statement = statement.where(
                repository.get_customer_id_filter_clause(customer_id)
            )

        if external_customer_id is not None:
            statement = statement.where(
                repository.get_external_customer_id_filter_clause(external_customer_id)
            )

        if meter_id is not None:
            meter_repository = MeterRepository.from_session(session)
            meter = await meter_repository.get_readable_by_id(meter_id, auth_subject)
            if meter is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "meter_id",
                            "msg": "Meter not found.",
                            "loc": ("query", "meter_id"),
                            "input": meter_id,
                        }
                    ]
                )
            statement = statement.where(repository.get_meter_clause(meter))

        if name is not None:
            statement = statement.where(Event.name.in_(name))

        if source is not None:
            statement = statement.where(Event.source.in_(source))

        if event_type_id is not None:
            statement = statement.where(Event.event_type_id == event_type_id)

        if query is not None:
            statement = statement.where(
                or_(
                    Event.name.ilike(f"%{query}%"),
                    Event.source.ilike(f"%{query}%"),
                    # Load customers and match against their name/email
                    Event.customer_id.in_(
                        select(Customer.id).where(
                            or_(
                                cast(Customer.id, String).ilike(f"%{query}%"),
                                Customer.external_id.ilike(f"%{query}%"),
                                Customer.name.ilike(f"%{query}%"),
                                Customer.email.ilike(f"%{query}%"),
                            )
                        )
                    ),
                    func.to_tsvector("simple", cast(Event.user_metadata, String)).op(
                        "@@"
                    )(func.plainto_tsquery(query)),
                )
            )

        if metadata is not None:
            statement = apply_metadata_clause(Event, statement, metadata)

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == EventSortProperty.timestamp:
                order_by_clauses.append(clause_function(Event.timestamp))
        statement = statement.order_by(*order_by_clauses)

        return statement

    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        filter: Filter | None = None,
        start_timestamp: datetime | None = None,
        end_timestamp: datetime | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        meter_id: uuid.UUID | None = None,
        name: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        event_type_id: uuid.UUID | None = None,
        metadata: MetadataQuery | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[EventSortProperty]] = (
            (EventSortProperty.timestamp, True),
        ),
        query: str | None = None,
        parent_id: uuid.UUID | None = None,
        depth: int | None = None,
        aggregate_fields: Sequence[str] = (),
        cursor_pagination: bool = False,
    ) -> tuple[Sequence[Event], int]:
        repository = EventRepository.from_session(session)
        statement = await self._build_filtered_statement(
            session,
            auth_subject,
            repository,
            filter=filter,
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
            sorting=sorting,
            query=query,
        )

        results, count = await repository.list_with_closure_table(
            statement,
            limit=pagination.limit,
            page=pagination.page,
            aggregate_fields=aggregate_fields,
            depth=depth,
            parent_id=parent_id,
            cursor_pagination=cursor_pagination,
            sorting=sorting,
        )

        await self._tinybird_compare_list(
            session,
            auth_subject,
            organization_id=organization_id,
            db_results=results,
            db_count=count,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            name=name,
            source=source,
            event_type_id=event_type_id,
            depth=depth,
            parent_id=parent_id,
            meter_id=meter_id,
            filter=filter,
            metadata=metadata,
            query=query,
            pagination=pagination,
            sorting=sorting,
        )

        return results, count

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
        aggregate_fields: Sequence[str] = (),
    ) -> Event | None:
        organization_ids = await self._get_readable_organization_ids(
            session, auth_subject, organization_id=None
        )
        if not organization_ids:
            return None

        tinybird_repository = TinybirdEventRepository()
        if not await tinybird_repository.event_exists(organization_ids, id):
            return None

        repository = EventRepository.from_session(session)
        event = await repository.get_by_id_with_eager(id)
        if event is None:
            return None

        if aggregate_fields:
            child_count, sums = await tinybird_repository.get_descendant_aggregates(
                organization_ids, id, aggregate_fields
            )
            event.child_count = child_count  # type: ignore[attr-defined]
            metadata = event.user_metadata or {}
            for field_path in aggregate_fields:
                key = field_path.replace(".", "_")
                value = sums.get(key, 0.0)
                parts = field_path.split(".")
                target = metadata
                for part in parts[:-1]:
                    if part not in target or not isinstance(target[part], dict):
                        target[part] = {}
                    target = target[part]
                target[parts[-1]] = round(value, 12)
            event.user_metadata = metadata

            if "_cost" in event.user_metadata:
                cost_obj = event.user_metadata.get("_cost")
                if cost_obj is None or cost_obj.get("amount") is None:
                    del event.user_metadata["_cost"]
                elif "currency" not in cost_obj:
                    cost_obj["currency"] = "usd"
        else:
            event.child_count = 0  # type: ignore[attr-defined]

        session.expunge(event)
        return event

    async def list_statistics_timeseries(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        interval: TimeInterval,
        filter: Filter | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        meter_id: uuid.UUID | None = None,
        name: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        event_type_id: uuid.UUID | None = None,
        metadata: MetadataQuery | None = None,
        sorting: Sequence[Sorting[EventSortProperty]] = (
            (EventSortProperty.timestamp, True),
        ),
        query: str | None = None,
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        hierarchy_stats_sorting: Sequence[tuple[str, bool]] = (("total", True),),
    ) -> ListStatisticsTimeseries:
        start_timestamp = datetime(
            start_date.year, start_date.month, start_date.day, 0, 0, 0, 0, timezone
        )
        end_timestamp = datetime(
            end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, timezone
        )

        timestamp_series_cte = get_timestamp_series_cte(
            start_timestamp, end_timestamp, interval
        )

        repository = EventRepository.from_session(session)
        statement = await self._build_filtered_statement(
            session,
            auth_subject,
            repository,
            filter=filter,
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
            sorting=sorting,
            query=query,
        )

        timeseries_stats = await repository.get_hierarchy_stats(
            statement,
            aggregate_fields,
            hierarchy_stats_sorting,
            timestamp_series=timestamp_series_cte,
            interval=interval,
            timezone=str(timezone),
        )

        result = await session.execute(select(timestamp_series_cte.c.timestamp))
        timestamps = [row[0] for row in result.all()]

        stats_by_timestamp: dict[datetime, list[dict[str, Any]]] = {}
        all_event_types: dict[tuple[str, str, uuid.UUID], dict[str, Any]] = {}

        for stat in timeseries_stats:
            ts = stat.pop("timestamp")
            if stat["name"] is None:
                continue
            if ts not in stats_by_timestamp:
                stats_by_timestamp[ts] = []
            stats_by_timestamp[ts].append(stat)

            # Track all unique event types
            event_key = (stat["name"], stat["label"], stat["event_type_id"])
            if event_key not in all_event_types:
                all_event_types[event_key] = {
                    "name": stat["name"],
                    "label": stat["label"],
                    "event_type_id": stat["event_type_id"],
                }

        # Convert field names from dot notation to underscore (e.g., "_cost.amount" -> "_cost_amount")
        zero_values = {field.replace(".", "_"): "0" for field in aggregate_fields}

        periods = []
        for i, period_start in enumerate(timestamps):
            if i + 1 < len(timestamps):
                period_end = timestamps[i + 1]
            else:
                period_end = end_timestamp

            period_stats = stats_by_timestamp.get(period_start, [])

            # Fill in missing event types with zeros
            stats_by_name = {s["name"]: s for s in period_stats}
            complete_stats = []
            for event_type_info in all_event_types.values():
                if event_type_info["name"] in stats_by_name:
                    complete_stats.append(stats_by_name[event_type_info["name"]])
                else:
                    complete_stats.append(
                        {
                            **event_type_info,
                            "occurrences": 0,
                            "customers": 0,
                            "totals": zero_values,
                            "averages": zero_values,
                            "p50": zero_values,
                            "p95": zero_values,
                            "p99": zero_values,
                        }
                    )

            periods.append(
                StatisticsPeriod(
                    timestamp=period_start,
                    period_start=period_start,
                    period_end=period_end,
                    stats=[EventStatistics(**s) for s in complete_stats],
                )
            )

        totals = await repository.get_hierarchy_stats(
            statement, aggregate_fields, hierarchy_stats_sorting
        )

        timeseries_result = ListStatisticsTimeseries(
            periods=periods,
            totals=[EventStatistics(**s) for s in totals],
        )

        await self._tinybird_compare_timeseries(
            session,
            auth_subject,
            organization_id=organization_id,
            db_result=timeseries_result,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            interval=interval,
            timezone=str(timezone),
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            name=name,
            event_type_id=event_type_id,
            aggregate_field=aggregate_fields[0] if aggregate_fields else "_cost.amount",
        )

        return timeseries_result

    async def list_names(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[EventNamesSortProperty]] = [
            (EventNamesSortProperty.last_seen, True)
        ],
    ) -> tuple[Sequence[EventName], int]:
        organization_ids = await self._get_readable_organization_ids(
            session, auth_subject, organization_id
        )
        if not organization_ids:
            return [], 0

        customer_repository = CustomerRepository.from_session(session)
        all_customer_ids: list[uuid.UUID] = list(customer_id or [])
        all_external_ids: list[str] = list(external_customer_id or [])
        if customer_id is not None:
            all_external_ids.extend(
                await customer_repository.get_readable_external_ids_by_ids(
                    auth_subject, customer_id
                )
            )
        if external_customer_id is not None:
            all_customer_ids.extend(
                await customer_repository.get_readable_ids_by_external_ids(
                    auth_subject, external_customer_id
                )
            )

        tinybird_repository = TinybirdEventRepository()

        tinybird_sorting: list[tuple[str, bool]] = []
        for criterion, is_desc in sorting:
            if criterion == EventNamesSortProperty.event_name:
                tinybird_sorting.append(("name", is_desc))
            elif criterion == EventNamesSortProperty.first_seen:
                tinybird_sorting.append(("first_seen", is_desc))
            elif criterion == EventNamesSortProperty.last_seen:
                tinybird_sorting.append(("last_seen", is_desc))
            elif criterion == EventNamesSortProperty.occurrences:
                tinybird_sorting.append(("occurrences", is_desc))

        tinybird_stats = await tinybird_repository.get_name_stats(
            organization_id=organization_ids,
            customer_id=all_customer_ids,
            external_customer_id=all_external_ids,
            source=source,
            query=query,
            sorting=tinybird_sorting,
        )

        total_count = len(tinybird_stats)
        start = (pagination.page - 1) * pagination.limit
        end = start + pagination.limit
        paginated_stats = tinybird_stats[start:end]

        event_names = [
            EventName(
                name=name,
                source=event_source,
                occurrences=occurrences,
                first_seen=first_seen,
                last_seen=last_seen,
            )
            for name, event_source, occurrences, first_seen, last_seen in paginated_stats
        ]

        return event_names, total_count

    async def _tinybird_compare_list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None,
        db_results: Sequence[Event],
        db_count: int,
        start_timestamp: datetime | None,
        end_timestamp: datetime | None,
        customer_id: Sequence[uuid.UUID] | None,
        external_customer_id: Sequence[str] | None,
        name: Sequence[str] | None,
        source: Sequence[EventSource] | None,
        event_type_id: uuid.UUID | None,
        depth: int | None,
        parent_id: uuid.UUID | None,
        meter_id: uuid.UUID | None,
        filter: Filter | None,
        metadata: MetadataQuery | None,
        query: str | None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[EventSortProperty]],
    ) -> None:
        org = await self._get_tinybird_enabled_org(
            session, auth_subject, organization_id
        )
        if org is None:
            return

        try:
            tinybird_repository = TinybirdEventRepository()
            query_filters: list[Filter] = []
            if filter is not None:
                query_filters.append(filter)

            cross_external_ids: list[str] = []
            if customer_id is not None:
                cross_ref = await session.execute(
                    select(Customer.external_id).where(
                        Customer.id.in_(customer_id),
                        Customer.external_id.isnot(None),
                    )
                )
                cross_external_ids = [r[0] for r in cross_ref.all()]

            cross_customer_ids: list[uuid.UUID] = []
            if external_customer_id is not None:
                cross_ref = await session.execute(
                    select(Customer.id).where(
                        Customer.external_id.in_(external_customer_id)
                    )
                )
                cross_customer_ids = [r[0] for r in cross_ref.all()]

            matching_cust_ids: list[uuid.UUID] | None = None
            matching_ext_ids: list[str] | None = None
            if query is not None:
                cust_results = await session.execute(
                    select(Customer.id, Customer.external_id).where(
                        Customer.organization_id == org.id,
                        or_(
                            cast(Customer.id, String).ilike(f"%{query}%"),
                            Customer.external_id.ilike(f"%{query}%"),
                            Customer.name.ilike(f"%{query}%"),
                            Customer.email.ilike(f"%{query}%"),
                        ),
                    )
                )
                matching_rows = cust_results.all()
                matching_cust_ids = [r.id for r in matching_rows]
                matching_ext_ids = [
                    r.external_id for r in matching_rows if r.external_id is not None
                ]

            numeric_metadata_property: str | None = None
            if meter_id is not None:
                meter_repository = MeterRepository.from_session(session)
                meter = await meter_repository.get_readable_by_id(
                    meter_id, auth_subject
                )
                if meter is not None:
                    query_filters.append(meter.filter)
                    if isinstance(meter.aggregation, PropertyAggregation):
                        prop = meter.aggregation.property
                        if prop in Event._filterable_fields:
                            allowed_type, _ = Event._filterable_fields[prop]
                            if allowed_type is not int:
                                return
                        else:
                            numeric_metadata_property = prop

            descending = sorting[0][1] if sorting else True
            offset = (pagination.page - 1) * pagination.limit
            all_customer_ids = [*(customer_id or []), *cross_customer_ids]
            all_external_ids = [*cross_external_ids, *(external_customer_id or [])]

            tb_ids, tb_count = await tinybird_repository.get_event_ids_and_count(
                organization_id=org.id,
                limit=pagination.limit,
                offset=offset,
                descending=descending,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
                customer_id=all_customer_ids,
                external_customer_id=all_external_ids,
                name=name,
                source=source,
                event_type_id=event_type_id,
                filters=query_filters,
                metadata=metadata,
                query=query,
                matching_customer_ids=matching_cust_ids,
                matching_external_customer_ids=matching_ext_ids,
                numeric_metadata_property=numeric_metadata_property,
                depth=depth,
                parent_id=parent_id,
            )

            db_ids = [str(e.id) for e in db_results]
            with logfire.span(
                "tinybird.shadow.events.list.comparison",
                organization_id=str(org.id),
                db_count=db_count,
                tinybird_count=tb_count,
                db_ids=db_ids,
                tinybird_ids=tb_ids,
                has_diff=db_ids != tb_ids,
            ):
                pass
        except Exception as e:
            log.error(
                "tinybird.events.list.failed",
                organization_id=str(org.id),
                error=str(e),
            )

    async def _tinybird_compare_timeseries(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None,
        db_result: ListStatisticsTimeseries,
        start_timestamp: datetime,
        end_timestamp: datetime,
        interval: TimeInterval,
        timezone: str,
        customer_id: Sequence[uuid.UUID] | None,
        external_customer_id: Sequence[str] | None,
        name: Sequence[str] | None,
        event_type_id: uuid.UUID | None,
        aggregate_field: str = "_cost.amount",
    ) -> None:
        org = await self._get_tinybird_enabled_org(
            session, auth_subject, organization_id
        )
        if org is None:
            return

        try:
            tinybird_repository = TinybirdEventRepository()
            tb_buckets = await tinybird_repository.get_timeseries_occurrences(
                organization_id=org.id,
                start_timestamp=start_timestamp,
                end_timestamp=end_timestamp,
                interval=interval.value,
                timezone=timezone,
                aggregate_field=aggregate_field,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                name=name,
                event_type_id=event_type_id,
            )

            tb_by_key: dict[tuple[str, datetime], TinybirdTimeseriesBucket] = {
                (b.name, b.bucket): b for b in tb_buckets
            }

            agg_label = aggregate_field.replace(".", "_")
            mismatches: list[dict[str, Any]] = []
            for period in db_result.periods:
                for stat in period.stats:
                    tb = tb_by_key.get((stat.name, period.timestamp))
                    tb_occ = tb.occurrences if tb else 0
                    tb_sum = tb.field_sum if tb else 0
                    db_sum = float(stat.totals.get(agg_label, 0))
                    if stat.occurrences != tb_occ or abs(db_sum - tb_sum) > 0.01:
                        mismatches.append(
                            {
                                "name": stat.name,
                                "timestamp": period.timestamp.isoformat(),
                                "db_occurrences": stat.occurrences,
                                "tb_occurrences": tb_occ,
                                "db_field_sum": db_sum,
                                "tb_field_sum": tb_sum,
                            }
                        )

            with logfire.span(
                "tinybird.shadow.events.timeseries.comparison",
                organization_id=str(org.id),
                aggregate_field=aggregate_field,
                db_periods=len(db_result.periods),
                tinybird_buckets=len(tb_buckets),
                has_diff=len(mismatches) > 0,
                mismatches=mismatches,
            ):
                pass
        except Exception as e:
            log.error(
                "tinybird.events.timeseries.failed",
                organization_id=str(org.id),
                error=str(e),
            )

    async def _get_tinybird_enabled_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[uuid.UUID] | None,
    ) -> Organization | None:
        if not settings.TINYBIRD_EVENTS_READ:
            return None

        org: Organization | None
        if is_organization(auth_subject):
            org = auth_subject.subject
        elif is_user(auth_subject):
            if not organization_id:
                return None
            organization_repository = OrganizationRepository.from_session(session)
            statement = organization_repository.get_readable_statement(
                auth_subject
            ).where(Organization.id == organization_id[0])
            org = await organization_repository.get_one_or_none(statement)
        else:
            return None

        if org is None:
            return None

        if org.feature_settings.get("tinybird_read", False) or org.feature_settings.get(
            "tinybird_compare", True
        ):
            return org

        return None

    async def ingest(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        ingest: EventsIngest,
    ) -> EventsIngestResponse:
        validate_organization_id = await self._get_organization_validation_function(
            session, auth_subject
        )
        customer_ids_in_batch = {
            e.customer_id for e in ingest.events if isinstance(e, EventCreateCustomer)
        }
        validate_customer_id = await self._get_customer_validation_function(
            session, auth_subject, customer_ids_in_batch
        )
        member_ids_in_batch = {
            e.member_id
            for e in ingest.events
            if isinstance(e, EventCreateCustomer) and e.member_id is not None
        }
        validate_member_id = await self._get_member_validation_function(
            session, member_ids_in_batch
        )

        event_type_repository = EventTypeRepository.from_session(session)
        event_types_cache: dict[tuple[str, uuid.UUID], uuid.UUID] = {}

        batch_external_id_map: dict[str, uuid.UUID] = {}
        for event_create in ingest.events:
            if event_create.external_id is not None:
                batch_external_id_map[event_create.external_id] = uuid.uuid4()

        # Build lightweight event metadata for sorting
        event_metadata: list[dict[str, Any]] = []
        for index, event_create in enumerate(ingest.events):
            metadata: dict[str, Any] = {
                "index": index,
                "external_id": event_create.external_id,
                "parent_id": event_create.parent_id,
            }
            if event_create.external_id:
                metadata["id"] = batch_external_id_map[event_create.external_id]
            event_metadata.append(metadata)

        with logfire.span("topological_sort", event_count=len(event_metadata)):
            sorted_metadata = _topological_sort_events(event_metadata)

        # Process events in sorted order
        events: list[dict[str, Any]] = []
        errors: list[ValidationError] = []
        processed_events: dict[uuid.UUID, dict[str, Any]] = {}

        with logfire.span("process_events", event_count=len(sorted_metadata)):
            for metadata in sorted_metadata:
                index = metadata["index"]
                event_create = ingest.events[index]

                try:
                    organization_id = validate_organization_id(
                        index, event_create.organization_id
                    )
                    if isinstance(event_create, EventCreateCustomer):
                        validate_customer_id(index, event_create.customer_id)
                        if event_create.member_id is not None:
                            validate_member_id(index, event_create.member_id)

                    parent_event: Event | None = None
                    parent_id_in_batch: uuid.UUID | None = None
                    if event_create.parent_id is not None:
                        parent_event, parent_id_in_batch = await self._resolve_parent(
                            session,
                            index,
                            event_create.parent_id,
                            organization_id,
                            batch_external_id_map,
                        )

                    event_label_cache_key = (event_create.name, organization_id)
                    if event_label_cache_key not in event_types_cache:
                        event_type = await event_type_repository.get_or_create(
                            event_create.name, organization_id
                        )
                        event_types_cache[event_label_cache_key] = event_type.id
                    event_type_id = event_types_cache[event_label_cache_key]
                except EventIngestValidationError as e:
                    errors.extend(e.errors)
                    continue
                else:
                    event_dict = event_create.model_dump(
                        exclude={"organization_id", "parent_id"}, by_alias=True
                    )
                    event_dict["source"] = EventSource.user
                    event_dict["organization_id"] = organization_id
                    event_dict["event_type_id"] = event_type_id

                    if event_create.external_id is not None:
                        event_dict["id"] = batch_external_id_map[
                            event_create.external_id
                        ]

                    if parent_event is not None:
                        event_dict["parent_id"] = parent_event.id
                        event_dict["root_id"] = parent_event.root_id or parent_event.id
                    elif parent_id_in_batch is not None:
                        event_dict["parent_id"] = parent_id_in_batch
                        # Parent was already processed, look it up
                        parent_dict = processed_events.get(parent_id_in_batch)
                        if parent_dict:
                            event_dict["root_id"] = parent_dict.get(
                                "root_id", parent_id_in_batch
                            )

                    events.append(event_dict)
                    if event_dict.get("id"):
                        processed_events[event_dict["id"]] = event_dict

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        repository = EventRepository.from_session(session)
        with logfire.span("insert_batch", event_count=len(events)):
            event_ids, duplicates_count = await repository.insert_batch(events)

        # Temporarily: fetch inserted events and create meter_events
        with logfire.span("create_meter_events", event_count=len(event_ids)):
            if event_ids:
                inserted_events = await repository.get_all(
                    repository.get_base_statement().where(Event.id.in_(event_ids))
                )
                await self._create_meter_events(session, inserted_events)

        with logfire.span("enqueue_events", event_count=len(event_ids)):
            enqueue_events(*event_ids)

        return EventsIngestResponse(
            inserted=len(event_ids), duplicates=duplicates_count
        )

    async def create_event(self, session: AsyncSession, event: Event) -> Event:
        repository = EventRepository.from_session(session)
        event = await repository.create(event, flush=True)
        # Temporarily
        await self._create_meter_events(session, [event])

        enqueue_events(event.id)

        log.debug(
            "Event created",
            id=event.id,
            name=event.name,
            source=event.source,
            metadata=event.user_metadata,
        )
        return event

    async def populate_event_closures_batch(
        self, session: AsyncSession, event_ids: Sequence[uuid.UUID]
    ) -> Mapping[uuid.UUID, Sequence[str]]:
        if not event_ids:
            return {}

        result = await session.execute(
            select(Event.id, Event.parent_id).where(Event.id.in_(event_ids))
        )
        events_data = result.all()

        events_list = [
            {"id": event_id, "parent_id": parent_id}
            for event_id, parent_id in events_data
        ]
        sorted_events = _topological_sort_events(events_list)

        all_closure_entries = []
        event_closures: dict[uuid.UUID, list[tuple[uuid.UUID, int]]] = {}
        ancestors_by_event: dict[uuid.UUID, list[str]] = {}

        for event in sorted_events:
            event_id = event["id"]
            parent_id = event.get("parent_id")

            event_closures[event_id] = [(event_id, 0)]
            all_closure_entries.append(
                {
                    "ancestor_id": event_id,
                    "descendant_id": event_id,
                    "depth": 0,
                }
            )

            if parent_id is not None:
                # Check if parent is in current batch
                if parent_id in event_closures:
                    # Parent is in current batch, use in-memory closures
                    for ancestor_id, depth in event_closures[parent_id]:
                        event_closures[event_id].append((ancestor_id, depth + 1))
                        all_closure_entries.append(
                            {
                                "ancestor_id": ancestor_id,
                                "descendant_id": event_id,
                                "depth": depth + 1,
                            }
                        )
                else:
                    # Parent is from previous batch, query database
                    parent_closures_result = await session.execute(
                        select(
                            EventClosure.ancestor_id,
                            EventClosure.depth,
                        ).where(EventClosure.descendant_id == parent_id)
                    )

                    for ancestor_id, depth in parent_closures_result:
                        event_closures[event_id].append((ancestor_id, depth + 1))
                        all_closure_entries.append(
                            {
                                "ancestor_id": ancestor_id,
                                "descendant_id": event_id,
                                "depth": depth + 1,
                            }
                        )

            ancestors_by_event[event_id] = [
                str(aid)
                for aid, d in sorted(event_closures[event_id], key=lambda x: x[1])
                if d > 0
            ]

        if all_closure_entries:
            await session.execute(
                insert(EventClosure)
                .values(all_closure_entries)
                .on_conflict_do_nothing(index_elements=["ancestor_id", "descendant_id"])
            )

        return ancestors_by_event

    async def ingested(
        self, session: AsyncSession, event_ids: Sequence[uuid.UUID]
    ) -> None:
        ancestors_by_event = await self.populate_event_closures_batch(
            session, event_ids
        )
        repository = EventRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .where(Event.id.in_(event_ids))
            .options(*repository.get_eager_options())
        )
        events = await repository.get_all(statement)
        customers: set[Customer] = set()
        organization_ids: set[uuid.UUID] = set()
        organization_ids_for_revops: set[uuid.UUID] = set()
        for event in events:
            organization_ids.add(event.organization_id)
            if event.customer and not event.customer.is_deleted:
                customers.add(event.customer)
            if "_cost" in event.user_metadata:
                organization_ids_for_revops.add(event.organization_id)

        span = trace.get_current_span()
        span.set_attribute(
            "organization_ids", [str(org_id) for org_id in organization_ids]
        )

        # Temporarily do this sync on ingestion instead
        # await self._create_meter_events(session, events)

        await self._activate_matching_customer_meters(
            session, repository, event_ids, customers
        )

        for customer in customers:
            enqueue_job("customer_meter.update_customer", customer.id)

        await ingest_events(events, ancestors_by_event)

        if organization_ids_for_revops:
            organization_repository = OrganizationRepository.from_session(session)
            await organization_repository.enable_revops(organization_ids_for_revops)

    async def _create_meter_events(
        self, session: AsyncSession, events: Sequence[Event]
    ) -> None:
        if not events:
            return

        with logfire.span("group_events_by_org"):
            events_by_org: dict[uuid.UUID, list[Event]] = {}
            for event in events:
                events_by_org.setdefault(event.organization_id, []).append(event)

        meter_repository = MeterRepository.from_session(session)
        meter_event_rows: list[dict[str, Any]] = []

        for org_id, org_events in events_by_org.items():
            meters = await meter_repository.get_all(
                meter_repository.get_base_statement().where(
                    Meter.organization_id == org_id,
                    Meter.archived_at.is_(None),
                )
            )

            with logfire.span(
                "match_meters",
                org_id=str(org_id),
                event_count=len(org_events),
                meter_count=len(meters),
            ):
                for event in org_events:
                    for meter in meters:
                        if self._event_matches_meter(event, meter):
                            meter_event_rows.append(
                                {
                                    "meter_id": meter.id,
                                    "event_id": event.id,
                                    "customer_id": event.customer_id,
                                    "external_customer_id": event.external_customer_id,
                                    "organization_id": event.organization_id,
                                    "ingested_at": event.ingested_at,
                                    "timestamp": event.timestamp,
                                }
                            )

        if meter_event_rows:
            await session.execute(
                insert(MeterEvent).values(meter_event_rows).on_conflict_do_nothing()
            )

    def _event_matches_meter(self, event: Event, meter: Meter) -> bool:
        if (
            event.source == EventSource.system
            and event.name in (SystemEvent.meter_credited, SystemEvent.meter_reset)
            and event.user_metadata.get("meter_id") == str(meter.id)
        ):
            return True

        return meter.filter.matches(event) and meter.aggregation.matches(event)

    async def _activate_matching_customer_meters(
        self,
        session: AsyncSession,
        event_repository: EventRepository,
        event_ids: Sequence[uuid.UUID],
        customers: set[Customer],
    ) -> None:
        if not customers:
            return

        customer_meter_repository = CustomerMeterRepository.from_session(session)
        customer_ids = [c.id for c in customers]

        statement = (
            customer_meter_repository.get_base_statement()
            .join(CustomerMeter.meter)
            .join(CustomerMeter.customer)
            .options(
                contains_eager(CustomerMeter.meter),
                contains_eager(CustomerMeter.customer),
            )
            .where(
                CustomerMeter.customer_id.in_(customer_ids),
                CustomerMeter.activated_at.is_(None),
            )
        )
        unactivated_meters = await customer_meter_repository.get_all(statement)

        for cm in unactivated_meters:
            customer_clause = or_(
                Event.customer_id == cm.customer_id,
                Event.external_customer_id == cm.customer.external_id,
            )

            matching_statement = (
                event_repository.get_base_statement()
                .where(
                    Event.id.in_(event_ids),
                    Event.organization_id == cm.meter.organization_id,
                    customer_clause,
                    event_repository.get_meter_clause(cm.meter),
                )
                .limit(1)
            )
            if await event_repository.get_one_or_none(matching_statement) is not None:
                cm.activated_at = utc_now()
                session.add(cm)
        await session.flush()

    async def _get_organization_validation_function(
        self, session: AsyncSession, auth_subject: AuthSubject[User | Organization]
    ) -> Callable[[int, uuid.UUID | None], uuid.UUID]:
        if is_organization(auth_subject):

            def _validate_organization_id_by_organization(
                index: int, organization_id: uuid.UUID | None
            ) -> uuid.UUID:
                if organization_id is not None:
                    raise EventIngestValidationError(
                        [
                            {
                                "type": "organization_token",
                                "msg": (
                                    "Setting organization_id is disallowed "
                                    "when using an organization token."
                                ),
                                "loc": ("body", "events", index, "organization_id"),
                                "input": organization_id,
                            }
                        ]
                    )
                return auth_subject.subject.id

            return _validate_organization_id_by_organization

        statement = select(Organization.id).where(
            Organization.id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.is_deleted.is_(False),
                )
            ),
        )
        result = await session.execute(statement)
        allowed_organizations = set(result.scalars().all())

        def _validate_organization_id_by_user(
            index: int, organization_id: uuid.UUID | None
        ) -> uuid.UUID:
            if organization_id is None:
                raise EventIngestValidationError(
                    [
                        {
                            "type": "missing",
                            "msg": "organization_id is required.",
                            "loc": ("body", "events", index, "organization_id"),
                            "input": None,
                        }
                    ]
                )
            if organization_id not in allowed_organizations:
                raise EventIngestValidationError(
                    [
                        {
                            "type": "organization_id",
                            "msg": "Organization not found.",
                            "loc": ("body", "events", index, "organization_id"),
                            "input": organization_id,
                        }
                    ]
                )

            return organization_id

        return _validate_organization_id_by_user

    async def _get_customer_validation_function(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        customer_ids: set[uuid.UUID],
    ) -> Callable[[int, uuid.UUID], uuid.UUID]:
        if not customer_ids:
            allowed_customers: set[uuid.UUID] = set()
        else:
            statement = select(Customer.id).where(
                Customer.is_deleted.is_(False),
                Customer.id.in_(customer_ids),
            )
            if is_user(auth_subject):
                statement = statement.where(
                    Customer.organization_id.in_(
                        select(UserOrganization.organization_id).where(
                            UserOrganization.user_id == auth_subject.subject.id,
                            UserOrganization.is_deleted.is_(False),
                        )
                    )
                )
            else:
                statement = statement.where(
                    Customer.organization_id == auth_subject.subject.id
                )
            result = await session.execute(statement)
            allowed_customers = set(result.scalars().all())

        def _validate_customer_id(index: int, customer_id: uuid.UUID) -> uuid.UUID:
            if customer_id not in allowed_customers:
                raise EventIngestValidationError(
                    [
                        {
                            "type": "customer_id",
                            "msg": "Customer not found.",
                            "loc": ("body", "events", index, "customer_id"),
                            "input": customer_id,
                        }
                    ]
                )

            return customer_id

        return _validate_customer_id

    async def _get_member_validation_function(
        self,
        session: AsyncSession,
        member_ids: set[uuid.UUID],
    ) -> Callable[[int, uuid.UUID], uuid.UUID]:
        member_repository = MemberRepository.from_session(session)
        allowed_members = await member_repository.get_existing_ids(member_ids)

        def _validate_member_id(index: int, member_id: uuid.UUID) -> uuid.UUID:
            if member_id not in allowed_members:
                raise EventIngestValidationError(
                    [
                        {
                            "type": "member_id",
                            "msg": "Member not found.",
                            "loc": ("body", "events", index, "member_id"),
                            "input": member_id,
                        }
                    ]
                )

            return member_id

        return _validate_member_id

    async def _resolve_parent(
        self,
        session: AsyncSession,
        index: int,
        parent_id: str,
        organization_id: uuid.UUID,
        batch_external_id_map: dict[str, uuid.UUID],
    ) -> tuple[Event | None, uuid.UUID | None]:
        """
        Resolve and return the parent event.
        Returns a tuple of (parent_event_from_db, parent_id_from_batch).
        Only one of these will be set - if the parent is in the current batch,
        parent_id_from_batch will be set. Otherwise, parent_event_from_db will be set.
        """
        # Check if parent is in current batch
        if parent_id in batch_external_id_map:
            return None, batch_external_id_map[parent_id]

        # Look up parent in database by ID or external_id
        try:
            parent_uuid = uuid.UUID(parent_id)
        except ValueError:
            parent_uuid = None

        if parent_uuid:
            statement = select(Event).where(
                Event.organization_id == organization_id,
                or_(Event.id == parent_uuid, Event.external_id == parent_id),
            )
        else:
            statement = select(Event).where(
                Event.organization_id == organization_id,
                Event.external_id == parent_id,
            )

        result = await session.execute(statement)
        parent_event = result.scalar_one_or_none()

        if parent_event is not None:
            return parent_event, None

        raise EventIngestValidationError(
            [
                {
                    "type": "parent_id",
                    "msg": "Parent event not found.",
                    "loc": ("body", "events", index, "parent_id"),
                    "input": parent_id,
                }
            ]
        )

    async def _get_readable_organization_ids(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[uuid.UUID] | None,
    ) -> Sequence[uuid.UUID]:
        if is_organization(auth_subject):
            if (
                organization_id is not None
                and auth_subject.subject.id not in organization_id
            ):
                return []
            return [auth_subject.subject.id]

        statement = select(UserOrganization.organization_id).where(
            UserOrganization.user_id == auth_subject.subject.id,
            UserOrganization.is_deleted.is_(False),
        )
        if organization_id is not None:
            statement = statement.where(
                UserOrganization.organization_id.in_(organization_id)
            )

        result = await session.execute(statement)
        return list(dict.fromkeys(result.scalars().all()))


event = EventService()
