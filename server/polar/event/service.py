import uuid
from collections.abc import Callable, Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

import logfire
import structlog
from opentelemetry import trace
from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.service import get_accessible_org_ids
from polar.authz.types import AccessibleOrganizationID
from polar.customer.repository import CustomerRepository
from polar.customer_meter.repository import CustomerMeterRepository
from polar.event.tinybird_repository import TinybirdEventRepository
from polar.event_type.repository import EventTypeRepository
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.integrations.tinybird.service import (
    TinybirdTimeseriesStats,
    events_to_tinybird,
)
from polar.kit.metadata import MetadataQuery
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.time_queries import TimeInterval
from polar.kit.utils import generate_uuid, utc_now
from polar.logging import Logger
from polar.meter.aggregation import PropertyAggregation
from polar.meter.filter import Filter
from polar.meter.repository import MeterRepository
from polar.models import (
    Customer,
    CustomerMeter,
    Event,
    Member,
    Meter,
    MeterEvent,
    Organization,
    User,
    UserOrganization,
)
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from polar.worker import enqueue_events, enqueue_job

from .repository import EventRepository
from .schemas import (
    CustomerStat,
    EventCreateCustomer,
    EventName,
    EventsIngest,
    EventsIngestResponse,
    EventStatistics,
    ListCustomerStats,
    ListPropertyGroupStats,
    ListStatisticsTimeseries,
    ListVarianceEvents,
    PropertyGroupStat,
    StatisticsPeriod,
    VarianceEvent,
)
from .sorting import EventNamesSortProperty, EventSortProperty
from .system import SystemEvent

log: Logger = structlog.get_logger()


class EventError(PolarError): ...


class EventIngestValidationError(EventError):
    def __init__(self, errors: list[ValidationError]) -> None:
        self.errors = errors
        super().__init__("Event ingest validation failed.")


class EventService:
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
        organization_ids = await self._get_organization_ids_for_subject(
            session, auth_subject, organization_id
        )
        if not organization_ids:
            return [], 0

        (
            query_filters,
            matching_cust_ids,
            matching_ext_ids,
            numeric_metadata_property,
        ) = await self._resolve_tinybird_filters(
            session,
            auth_subject,
            organization_ids,
            filter=filter,
            meter_id=meter_id,
            query=query,
        )

        customer_repository = CustomerRepository.from_session(session)
        all_customer_ids: list[uuid.UUID] = list(customer_id or [])
        all_external_ids: list[str] = list(external_customer_id or [])
        if customer_id is not None:
            all_external_ids.extend(
                await customer_repository.get_readable_external_ids_by_ids(
                    organization_ids, customer_id
                )
            )
        if external_customer_id is not None:
            all_customer_ids.extend(
                await customer_repository.get_readable_ids_by_external_ids(
                    organization_ids, external_customer_id
                )
            )

        tinybird_repository = TinybirdEventRepository()
        descending = sorting[0][1] if sorting else True
        offset = (pagination.page - 1) * pagination.limit

        tb_ids, tb_count = await tinybird_repository.get_event_ids_and_count(
            organization_id=list(organization_ids),
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

        if not tb_ids:
            return [], 0

        event_uuids = [uuid.UUID(id_str) for id_str in tb_ids]
        repository = EventRepository.from_session(session)
        events = await repository.get_by_ids_with_eager(
            event_uuids, list(organization_ids)
        )

        all_aggregates = await tinybird_repository.get_batch_descendant_aggregates(
            list(organization_ids), [e.id for e in events], aggregate_fields
        )
        empty_sums = {f.replace(".", "_"): 0.0 for f in aggregate_fields}

        for event in events:
            child_count, sums = all_aggregates.get(str(event.id), (0, empty_sums))
            event.child_count = child_count  # type: ignore[attr-defined]
            if aggregate_fields:
                event_metadata = event.user_metadata or {}
                for field_path in aggregate_fields:
                    key = field_path.replace(".", "_")
                    descendant_value = sums.get(key, 0.0)
                    parts = field_path.split(".")
                    own_target = event_metadata
                    for part in parts[:-1]:
                        own_target = (
                            own_target.get(part, {})
                            if isinstance(own_target, dict)
                            else {}
                        )
                    own_value = (
                        own_target.get(parts[-1], 0)
                        if isinstance(own_target, dict)
                        else 0
                    )
                    try:
                        own_value = float(own_value)
                    except (TypeError, ValueError):
                        own_value = 0.0
                    total_value = descendant_value + own_value
                    target = event_metadata
                    for part in parts[:-1]:
                        if part not in target or not isinstance(target[part], dict):
                            target[part] = {}
                        target = target[part]
                    target[parts[-1]] = round(total_value, 12)
                event.user_metadata = event_metadata
                if "_cost" in event.user_metadata:
                    cost_obj = event.user_metadata.get("_cost")
                    if cost_obj is None or cost_obj.get("amount") is None:
                        del event.user_metadata["_cost"]
                    elif "currency" not in cost_obj:
                        cost_obj["currency"] = "usd"
            session.expunge(event)

        if cursor_pagination:
            has_next_page = 1 if (offset + len(events)) < tb_count else 0
            return events, has_next_page

        return events, tb_count

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
        aggregate_fields: Sequence[str] = (),
    ) -> Event | None:
        organization_ids = await self._get_organization_ids_for_subject(
            session, auth_subject, organization_id=None
        )
        if not organization_ids:
            return None

        tinybird_repository = TinybirdEventRepository()
        if not await tinybird_repository.event_exists(list(organization_ids), id):
            return None

        repository = EventRepository.from_session(session)
        event = await repository.get_by_id_with_eager(id)
        if event is None:
            return None

        if aggregate_fields:
            child_count, sums = await tinybird_repository.get_descendant_aggregates(
                list(organization_ids), id, aggregate_fields
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

        organization_ids = await self._get_organization_ids_for_subject(
            session, auth_subject, organization_id
        )
        if not organization_ids:
            return ListStatisticsTimeseries(periods=[], totals=[])

        (
            query_filters,
            matching_cust_ids,
            matching_ext_ids,
            numeric_metadata_property,
        ) = await self._resolve_tinybird_filters(
            session,
            auth_subject,
            organization_ids,
            filter=filter,
            meter_id=meter_id,
            query=query,
        )

        customer_repository = CustomerRepository.from_session(session)
        all_customer_ids: list[uuid.UUID] = list(customer_id or [])
        all_external_ids: list[str] = list(external_customer_id or [])
        if customer_id is not None:
            all_external_ids.extend(
                await customer_repository.get_readable_external_ids_by_ids(
                    organization_ids, customer_id
                )
            )
        if external_customer_id is not None:
            all_customer_ids.extend(
                await customer_repository.get_readable_ids_by_external_ids(
                    organization_ids, external_customer_id
                )
            )

        tb_query_kwargs: dict[str, Any] = dict(
            organization_id=list(organization_ids),
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            aggregate_fields=tuple(aggregate_fields),
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
        )

        tinybird_repository = TinybirdEventRepository()
        tb_buckets = await tinybird_repository.get_filtered_timeseries(
            interval=interval.value,
            timezone=str(timezone),
            **tb_query_kwargs,
        )
        tb_totals = await tinybird_repository.get_filtered_totals(**tb_query_kwargs)

        all_names = list({b.name for b in tb_buckets} | {b.name for b in tb_totals})
        event_type_repository = EventTypeRepository.from_session(session)
        event_types_by_name = await event_type_repository.get_by_names_and_organization(
            all_names, list(organization_ids)
        )

        def _to_decimal_dict(d: dict[str, float]) -> dict[str, Decimal]:
            return {k: Decimal(str(round(v, 12))) for k, v in d.items()}

        def _to_uuid(value: str | uuid.UUID) -> uuid.UUID:
            return value if isinstance(value, uuid.UUID) else uuid.UUID(value)

        def _row_to_stats(row: TinybirdTimeseriesStats) -> EventStatistics:
            org_id = _to_uuid(row.organization_id)
            et = event_types_by_name.get((org_id, row.name))
            return EventStatistics(
                name=row.name,
                label=et.label if et else row.name,
                event_type_id=et.id if et else uuid.UUID(int=0),
                occurrences=row.occurrences,
                customers=row.customers,
                totals=_to_decimal_dict(row.totals),
                averages=_to_decimal_dict(row.averages),
                p10=_to_decimal_dict(row.p10),
                p90=_to_decimal_dict(row.p90),
                p99=_to_decimal_dict(row.p99),
            )

        zero_values: dict[str, Decimal] = {
            f.replace(".", "_"): Decimal(0) for f in aggregate_fields
        }

        def _sort_stats(stats: list[EventStatistics]) -> list[EventStatistics]:
            for criterion, is_desc in reversed(hierarchy_stats_sorting):
                sort_key = self._get_stats_sort_key(criterion, aggregate_fields)
                stats.sort(key=sort_key, reverse=is_desc)
            return stats

        repository = EventRepository.from_session(session)
        timestamps = await repository.get_timestamp_series(
            start_timestamp, end_timestamp, interval
        )

        type _EventKey = tuple[str, str]  # (organization_id, name)

        buckets_by_ts: dict[datetime, list[TinybirdTimeseriesStats]] = {}
        all_event_keys: set[_EventKey] = set()
        for bucket in tb_buckets:
            buckets_by_ts.setdefault(bucket.bucket, []).append(bucket)
            all_event_keys.add((bucket.organization_id, bucket.name))

        periods = []
        for i, period_start in enumerate(timestamps):
            period_end = timestamps[i + 1] if i + 1 < len(timestamps) else end_timestamp

            period_buckets = buckets_by_ts.get(period_start, [])
            stats_by_key: dict[_EventKey, EventStatistics] = {
                (b.organization_id, b.name): _row_to_stats(b) for b in period_buckets
            }

            complete_stats: list[EventStatistics] = []
            for event_key in all_event_keys:
                if event_key in stats_by_key:
                    complete_stats.append(stats_by_key[event_key])
                else:
                    org_id = _to_uuid(event_key[0])
                    event_name = event_key[1]
                    et = event_types_by_name.get((org_id, event_name))
                    complete_stats.append(
                        EventStatistics(
                            name=event_name,
                            label=et.label if et else event_name,
                            event_type_id=et.id if et else uuid.UUID(int=0),
                            occurrences=0,
                            customers=0,
                            totals=zero_values,
                            averages=zero_values,
                            p10=zero_values,
                            p90=zero_values,
                            p99=zero_values,
                        )
                    )

            periods.append(
                StatisticsPeriod(
                    timestamp=period_start,
                    period_start=period_start,
                    period_end=period_end,
                    stats=_sort_stats(complete_stats),
                )
            )

        totals = _sort_stats([_row_to_stats(b) for b in tb_totals])

        return ListStatisticsTimeseries(periods=periods, totals=totals)

    async def list_property_group_stats(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        property: str,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        limit: int = 200,
    ) -> ListPropertyGroupStats:
        start_timestamp = datetime(
            start_date.year, start_date.month, start_date.day, 0, 0, 0, 0, timezone
        )
        end_timestamp = datetime(
            end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, timezone
        )

        organization_ids = await self._get_organization_ids_for_subject(
            session, auth_subject, organization_id
        )
        if not organization_ids:
            return ListPropertyGroupStats(items=[])
        customer_repository = CustomerRepository.from_session(session)
        all_customer_ids: list[uuid.UUID] = list(customer_id or [])
        all_external_ids: list[str] = list(external_customer_id or [])
        if customer_id is not None:
            all_external_ids.extend(
                await customer_repository.get_readable_external_ids_by_ids(
                    organization_ids, customer_id
                )
            )
        if external_customer_id is not None:
            all_customer_ids.extend(
                await customer_repository.get_readable_ids_by_external_ids(
                    organization_ids, external_customer_id
                )
            )

        tinybird_event_repository = TinybirdEventRepository()
        rows = await tinybird_event_repository.get_property_group_stats(
            organization_id=list(organization_ids),
            property=property,
            aggregate_fields=tuple(aggregate_fields),
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            customer_id=all_customer_ids,
            external_customer_id=all_external_ids,
            limit=limit,
        )

        items = [
            PropertyGroupStat(
                value=row.value,
                occurrences=row.occurrences,
                customers=row.customers,
                totals={k: Decimal(str(v)) for k, v in row.totals.items()},
            )
            for row in rows
        ]
        return ListPropertyGroupStats(items=items)

    async def list_customer_stats(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        limit: int = 200,
    ) -> ListCustomerStats:
        start_timestamp = datetime(
            start_date.year, start_date.month, start_date.day, 0, 0, 0, 0, timezone
        )
        end_timestamp = datetime(
            end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, timezone
        )

        organization_ids = await self._get_organization_ids_for_subject(
            session, auth_subject, organization_id
        )
        if not organization_ids:
            return ListCustomerStats(items=[])
        customer_repository = CustomerRepository.from_session(session)
        all_customer_ids: list[uuid.UUID] = list(customer_id or [])
        all_external_ids: list[str] = list(external_customer_id or [])
        if customer_id is not None:
            all_external_ids.extend(
                await customer_repository.get_readable_external_ids_by_ids(
                    organization_ids, customer_id
                )
            )
        if external_customer_id is not None:
            all_customer_ids.extend(
                await customer_repository.get_readable_ids_by_external_ids(
                    organization_ids, external_customer_id
                )
            )

        tinybird_event_repository = TinybirdEventRepository()
        rows = await tinybird_event_repository.get_customer_stats(
            organization_id=list(organization_ids),
            aggregate_fields=tuple(aggregate_fields),
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            customer_id=all_customer_ids,
            external_customer_id=all_external_ids,
            limit=limit,
        )

        # Fetch customer details for all rows that have a Polar customer_id
        row_customer_ids = [
            uuid.UUID(row.customer_id) for row in rows if row.customer_id
        ]
        customers_by_id: dict[uuid.UUID, Customer] = {}
        if row_customer_ids:
            customer_stmt = customer_repository.get_base_statement().where(
                Customer.id.in_(row_customer_ids)
            )
            found = await customer_repository.get_all(customer_stmt)
            customers_by_id = {c.id: c for c in found}

        items = [
            CustomerStat(
                customer_id=uuid.UUID(row.customer_id) if row.customer_id else None,
                external_customer_id=row.external_customer_id,
                name=customers_by_id[uuid.UUID(row.customer_id)].name
                if row.customer_id and uuid.UUID(row.customer_id) in customers_by_id
                else None,
                email=customers_by_id[uuid.UUID(row.customer_id)].email
                if row.customer_id and uuid.UUID(row.customer_id) in customers_by_id
                else None,
                occurrences=row.occurrences,
                totals={k: Decimal(str(round(v, 12))) for k, v in row.totals.items()},
                share=Decimal(str(round(row.share, 6))),
            )
            for row in rows
        ]
        return ListCustomerStats(items=items)

    async def list_variance_events(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
        timezone: ZoneInfo,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        name: Sequence[str] | None = None,
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        limit: int = 100,
    ) -> ListVarianceEvents:
        start_timestamp = datetime(
            start_date.year, start_date.month, start_date.day, 0, 0, 0, 0, timezone
        )
        end_timestamp = datetime(
            end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999, timezone
        )

        organization_ids = await self._get_organization_ids_for_subject(
            session, auth_subject, organization_id
        )
        if not organization_ids:
            return ListVarianceEvents(items=[])
        customer_repository = CustomerRepository.from_session(session)
        all_customer_ids: list[uuid.UUID] = list(customer_id or [])
        all_external_ids: list[str] = list(external_customer_id or [])
        if customer_id is not None:
            all_external_ids.extend(
                await customer_repository.get_readable_external_ids_by_ids(
                    organization_ids, customer_id
                )
            )
        if external_customer_id is not None:
            all_customer_ids.extend(
                await customer_repository.get_readable_ids_by_external_ids(
                    organization_ids, external_customer_id
                )
            )

        tinybird_event_repository = TinybirdEventRepository()
        rows = await tinybird_event_repository.get_variance_events(
            organization_id=list(organization_ids),
            aggregate_fields=tuple(aggregate_fields),
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            customer_id=all_customer_ids,
            external_customer_id=all_external_ids,
            name=name,
            limit=limit,
        )

        items = [
            VarianceEvent(
                event_id=uuid.UUID(row.event_id),
                name=row.name,
                customer_id=uuid.UUID(row.customer_id) if row.customer_id else None,
                external_customer_id=row.external_customer_id,
                timestamp=row.timestamp,
                values={k: Decimal(str(round(v, 12))) for k, v in row.values.items()},
                averages={
                    k: Decimal(str(round(v, 12))) for k, v in row.averages.items()
                },
                p99={k: Decimal(str(round(v, 12))) for k, v in row.p99.items()},
            )
            for row in rows
        ]
        return ListVarianceEvents(items=items)

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
        organization_ids = await self._get_organization_ids_for_subject(
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
                    organization_ids, customer_id
                )
            )
        if external_customer_id is not None:
            all_customer_ids.extend(
                await customer_repository.get_readable_ids_by_external_ids(
                    organization_ids, external_customer_id
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
            organization_id=list(organization_ids),
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

    @staticmethod
    def _get_stats_sort_key(
        criterion: str, aggregate_fields: Sequence[str]
    ) -> Callable[[EventStatistics], Any]:
        if criterion == "name":
            return lambda s: s.name
        if criterion == "occurrences":
            return lambda s: s.occurrences
        agg_label = aggregate_fields[0].replace(".", "_") if aggregate_fields else ""
        field_map: dict[str, Callable[[EventStatistics], Any]] = {
            "total": lambda s: s.totals.get(agg_label, Decimal(0)),
            "average": lambda s: s.averages.get(agg_label, Decimal(0)),
            "p10": lambda s: s.p10.get(agg_label, Decimal(0)),
            "p90": lambda s: s.p90.get(agg_label, Decimal(0)),
            "p95": lambda s: s.p90.get(agg_label, Decimal(0)),
            "p99": lambda s: s.p99.get(agg_label, Decimal(0)),
        }
        return field_map.get(criterion, lambda s: 0)

    async def _resolve_tinybird_filters(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization_ids: set[AccessibleOrganizationID],
        *,
        filter: Filter | None = None,
        meter_id: uuid.UUID | None = None,
        query: str | None = None,
    ) -> tuple[
        Sequence[Filter],
        Sequence[uuid.UUID] | None,
        Sequence[str] | None,
        str | None,
    ]:
        query_filters: list[Filter] = []
        if filter is not None:
            query_filters.append(filter)

        numeric_metadata_property: str | None = None
        if meter_id is not None:
            meter_repository = MeterRepository.from_session(session)
            meter = await meter_repository.get_readable_by_id(
                meter_id, organization_ids
            )
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
            query_filters.append(meter.filter)
            if isinstance(meter.aggregation, PropertyAggregation):
                prop = meter.aggregation.property
                if prop not in Event._filterable_fields:
                    numeric_metadata_property = prop

        matching_cust_ids: list[uuid.UUID] | None = None
        matching_ext_ids: list[str] | None = None
        if query is not None:
            customer_repository = CustomerRepository.from_session(session)
            (
                matching_cust_ids,
                matching_ext_ids,
            ) = await customer_repository.search_by_query(organization_ids, query)

        return (
            query_filters,
            matching_cust_ids,
            matching_ext_ids,
            numeric_metadata_property,
        )

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
            session, auth_subject, member_ids_in_batch
        )

        event_type_repository = EventTypeRepository.from_session(session)
        event_types_cache: dict[tuple[str, uuid.UUID], uuid.UUID] = {}

        events: list[dict[str, Any]] = []
        errors: list[ValidationError] = []
        for index, event_create in enumerate(ingest.events):
            try:
                organization_id = validate_organization_id(
                    index, event_create.organization_id
                )
                if isinstance(event_create, EventCreateCustomer):
                    validate_customer_id(index, event_create.customer_id)
                    if event_create.member_id is not None:
                        validate_member_id(index, event_create.member_id)

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

            event_dict = event_create.model_dump(
                exclude={"organization_id", "parent_id"}, by_alias=True
            )
            event_dict["source"] = EventSource.user
            event_dict["organization_id"] = organization_id
            event_dict["event_type_id"] = event_type_id

            if event_create.parent_id is not None:
                event_dict["pending_parent_external_id"] = event_create.parent_id

            events.append(event_dict)

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        repository = EventRepository.from_session(session)
        event_ids, duplicates_count = await repository.insert_batch(events)

        # Temporarily: fetch inserted events and create meter_events
        with logfire.span("create_meter_events", event_count=len(event_ids)):
            if event_ids:
                inserted_events = await repository.get_all(
                    repository.get_base_statement().where(Event.id.in_(event_ids))
                )
                await self._create_meter_events(session, inserted_events)

        # Parent resolution and root_id propagation run out-of-band in the
        # `event.ingested` task — they're not needed on the request path and
        # can be slow under contention.
        enqueue_events(*event_ids)

        return EventsIngestResponse(
            inserted=len(event_ids), duplicates=duplicates_count
        )

    async def create_event(self, session: AsyncSession, event: Event) -> Event:
        repository = EventRepository.from_session(session)
        if (
            event.source == EventSource.system
            and event.parent_id is None
            and event.root_id is None
        ):
            if event.id is None:
                event.id = generate_uuid()
            event.root_id = event.id
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

    async def _build_ancestors_batch(
        self, session: AsyncSession, event_ids: Sequence[uuid.UUID]
    ) -> Mapping[uuid.UUID, Sequence[str]]:
        repository = EventRepository.from_session(session)
        return await repository.get_ancestors_batch(event_ids)

    async def ingested(
        self, session: AsyncSession, event_ids: Sequence[uuid.UUID]
    ) -> None:
        repository = EventRepository.from_session(session)

        # Resolve parent links and propagate root_id here so it's off the
        # ingestion hot path. `resolved_ids` includes pre-existing orphan
        # events whose root_id was just set because an ancestor arrived in
        # this batch — they also need downstream processing.
        resolved_ids = await repository.resolve_pending_parents(event_ids)
        candidate_ids = {*event_ids, *resolved_ids}
        if not candidate_ids:
            return

        # Only process events whose chain is complete (root_id set). Events
        # still pending a parent stay out of Tinybird/meters until a future
        # batch resolves their root.
        statement = (
            repository.get_base_statement()
            .where(Event.id.in_(candidate_ids), Event.root_id.is_not(None))
            .options(*repository.get_eager_options())
        )
        events = await repository.get_all(statement)
        if not events:
            return

        complete_ids = [event.id for event in events]
        ancestors_by_event = await self._build_ancestors_batch(session, complete_ids)

        customers: set[Customer] = set()
        organization_ids: set[uuid.UUID] = set()
        for event in events:
            organization_ids.add(event.organization_id)
            if event.customer and not event.customer.is_deleted:
                customers.add(event.customer)

        span = trace.get_current_span()
        span.set_attribute(
            "organization_ids", [str(org_id) for org_id in organization_ids]
        )

        # Temporarily do this sync on ingestion instead
        # await self._create_meter_events(session, events)

        await self._activate_matching_customer_meters(
            session, repository, complete_ids, customers
        )

        for customer in customers:
            enqueue_job("customer_meter.update_customer", customer.id)

        tinybird_events = events_to_tinybird(events, ancestors_by_event)
        enqueue_job("tinybird.ingest", tinybird_events)

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
        auth_subject: AuthSubject[User | Organization],
        member_ids: set[uuid.UUID],
    ) -> Callable[[int, uuid.UUID], uuid.UUID]:
        if not member_ids:
            allowed_members: set[uuid.UUID] = set()
        else:
            statement = select(Member.id).where(
                Member.is_deleted.is_(False),
                Member.id.in_(member_ids),
            )
            if is_user(auth_subject):
                statement = statement.where(
                    Member.organization_id.in_(
                        select(UserOrganization.organization_id).where(
                            UserOrganization.user_id == auth_subject.subject.id,
                            UserOrganization.is_deleted.is_(False),
                        )
                    )
                )
            else:
                statement = statement.where(
                    Member.organization_id == auth_subject.subject.id
                )
            result = await session.execute(statement)
            allowed_members = set(result.scalars().all())

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

    async def _get_organization_ids_for_subject(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[uuid.UUID] | None,
    ) -> set[AccessibleOrganizationID]:
        """Get accessible org IDs, optionally filtered to a subset."""
        organization_ids = await get_accessible_org_ids(session, auth_subject)
        if organization_id is not None:
            return {
                AccessibleOrganizationID(oid)
                for oid in organization_id
                if oid in organization_ids
            }
        return set(organization_ids)


event = EventService()
