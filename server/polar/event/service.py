import uuid
from collections import defaultdict
from collections.abc import Callable, Sequence
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

import structlog
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
    text,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.customer.repository import CustomerRepository
from polar.customer_meter.repository import CustomerMeterRepository
from polar.event_type.repository import EventTypeRepository
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.meter.filter import Filter
from polar.meter.repository import MeterRepository
from polar.models import (
    Customer,
    CustomerMeter,
    Event,
    EventClosure,
    Organization,
    User,
    UserOrganization,
)
from polar.models.event import EventSource
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from polar.worker import enqueue_events

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

    queue = [idx for idx in range(len(events)) if in_degree[idx] == 0]
    sorted_indices = []

    while queue:
        current_idx = queue.pop(0)
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

        return await repository.list_with_closure_table(
            statement,
            limit=pagination.limit,
            page=pagination.page,
            aggregate_fields=aggregate_fields,
            depth=depth,
            parent_id=parent_id,
            cursor_pagination=cursor_pagination,
            sorting=sorting,
        )

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
        aggregate_fields: Sequence[str] = (),
    ) -> Event | None:
        repository = EventRepository.from_session(session)

        if aggregate_fields:
            return await repository.get_with_aggregation(
                auth_subject, id, aggregate_fields
            )

        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Event.id == id)
            .options(*repository.get_eager_options())
        )
        return await repository.get_one_or_none(statement)

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

        return ListStatisticsTimeseries(
            periods=periods,
            totals=[EventStatistics(**s) for s in totals],
        )

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
        repository = EventRepository.from_session(session)
        statement = repository.get_event_names_statement(auth_subject)

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

        if source is not None:
            statement = statement.where(Event.source.in_(source))

        if query is not None:
            statement = statement.where(Event.name.ilike(f"%{query}%"))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == EventNamesSortProperty.event_name:
                order_by_clauses.append(clause_function(Event.name))
            elif criterion == EventNamesSortProperty.first_seen:
                order_by_clauses.append(clause_function(text("first_seen")))
            elif criterion == EventNamesSortProperty.last_seen:
                order_by_clauses.append(clause_function(text("last_seen")))
            elif criterion == EventNamesSortProperty.occurrences:
                order_by_clauses.append(clause_function(text("occurrences")))
        statement = statement.order_by(*order_by_clauses)

        results, count = await paginate(session, statement, pagination=pagination)

        event_names: list[EventName] = []
        for result in results:
            event_name, event_source, occurrences, first_seen, last_seen = result
            event_names.append(
                EventName(
                    name=event_name,
                    source=event_source,
                    occurrences=occurrences,
                    first_seen=first_seen,
                    last_seen=last_seen,
                )
            )

        return event_names, count

    async def ingest(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        ingest: EventsIngest,
    ) -> EventsIngestResponse:
        validate_organization_id = await self._get_organization_validation_function(
            session, auth_subject
        )
        validate_customer_id = await self._get_customer_validation_function(
            session, auth_subject
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

        sorted_metadata = _topological_sort_events(event_metadata)

        # Process events in sorted order
        events: list[dict[str, Any]] = []
        errors: list[ValidationError] = []
        processed_events: dict[uuid.UUID, dict[str, Any]] = {}

        for metadata in sorted_metadata:
            index = metadata["index"]
            event_create = ingest.events[index]

            try:
                organization_id = validate_organization_id(
                    index, event_create.organization_id
                )
                if isinstance(event_create, EventCreateCustomer):
                    validate_customer_id(index, event_create.customer_id)

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
                    event_dict["id"] = batch_external_id_map[event_create.external_id]

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
        event_ids, duplicates_count = await repository.insert_batch(events)

        enqueue_events(*event_ids)

        return EventsIngestResponse(
            inserted=len(event_ids), duplicates=duplicates_count
        )

    async def create_event(self, session: AsyncSession, event: Event) -> Event:
        repository = EventRepository.from_session(session)
        event = await repository.create(event, flush=True)
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
    ) -> None:
        if not event_ids:
            return

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
        # Map event_id -> list of its ancestor closures (including self)
        event_closures: dict[uuid.UUID, list[tuple[uuid.UUID, int]]] = {}

        for event in sorted_events:
            event_id = event["id"]
            parent_id = event.get("parent_id")

            # Self-reference
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

        # Single bulk insert
        if all_closure_entries:
            await session.execute(
                insert(EventClosure)
                .values(all_closure_entries)
                .on_conflict_do_nothing(index_elements=["ancestor_id", "descendant_id"])
            )

    async def ingested(
        self, session: AsyncSession, event_ids: Sequence[uuid.UUID]
    ) -> None:
        await self.populate_event_closures_batch(session, event_ids)
        repository = EventRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .where(Event.id.in_(event_ids))
            .options(*repository.get_eager_options())
        )
        events = await repository.get_all(statement)
        customers: set[Customer] = set()
        organization_ids_for_revops: set[uuid.UUID] = set()
        for event in events:
            if event.customer:
                customers.add(event.customer)
            if "_cost" in event.user_metadata:
                organization_ids_for_revops.add(event.organization_id)

        await self._activate_matching_customer_meters(
            session, repository, event_ids, customers
        )

        customer_repository = CustomerRepository.from_session(session)
        await customer_repository.touch_meters(customers)

        if organization_ids_for_revops:
            organization_repository = OrganizationRepository.from_session(session)
            await organization_repository.enable_revops(organization_ids_for_revops)

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
                    UserOrganization.deleted_at.is_(None),
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
        self, session: AsyncSession, auth_subject: AuthSubject[User | Organization]
    ) -> Callable[[int, uuid.UUID], uuid.UUID]:
        statement = select(Customer.id).where(Customer.deleted_at.is_(None))
        if is_user(auth_subject):
            statement = statement.where(
                Customer.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
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


event = EventService()
