from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from polar.integrations.tinybird.service import (
    TinybirdEventsQuery,
    TinybirdEventTypesQuery,
    TinybirdEventTypeStats,
    TinybirdTimeseriesBucket,
    get_timeseries_occurrences,
)
from polar.kit.metadata import MetadataQuery
from polar.meter.filter import Filter
from polar.models.event import EventSource

type EventNameStats = tuple[str, EventSource, int, datetime, datetime]


class TinybirdEventRepository:
    async def get_name_stats(
        self,
        *,
        organization_id: Sequence[UUID] | None = None,
        customer_id: Sequence[UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        query: str | None = None,
        sorting: Sequence[tuple[str, bool]] = (),
    ) -> list[EventNameStats]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return []

        tinybird_query = TinybirdEventsQuery(organization_ids)

        if customer_id is not None:
            tinybird_query.filter_customer_id(customer_id)
        if external_customer_id is not None:
            tinybird_query.filter_external_customer_id(external_customer_id)
        if source is not None:
            tinybird_query.filter_sources(source)
        if query is not None:
            tinybird_query.filter_name_query(query)

        self._apply_ordering(tinybird_query, sorting)

        stats = await tinybird_query.get_event_type_stats()
        return [
            (stat.name, stat.source, stat.occurrences, stat.first_seen, stat.last_seen)
            for stat in stats
        ]

    async def get_event_type_stats(
        self,
        *,
        organization_id: UUID | Sequence[UUID],
        customer_id: Sequence[UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        root_events: bool = False,
        parent_id: UUID | None = None,
        source: EventSource | None = None,
        sorting: Sequence[tuple[str, bool]] = (),
    ) -> list[TinybirdEventTypeStats]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return []

        requires_raw_table = (
            len(organization_ids) > 1
            or customer_id is not None
            or external_customer_id is not None
            or root_events
            or parent_id is not None
        )

        tinybird_query: TinybirdEventsQuery | TinybirdEventTypesQuery
        if requires_raw_table:
            tinybird_query = TinybirdEventsQuery(organization_ids)
            if customer_id is not None:
                tinybird_query.filter_customer_id(customer_id)
            if external_customer_id is not None:
                tinybird_query.filter_external_customer_id(external_customer_id)
            if root_events:
                tinybird_query.filter_root_events()
            if parent_id is not None:
                tinybird_query.filter_parent_id(parent_id)
            if source is not None:
                tinybird_query.filter_source(source)
        else:
            tinybird_query = TinybirdEventTypesQuery(organization_ids[0])
            if source is not None:
                tinybird_query.filter_source(source)

        self._apply_ordering(tinybird_query, sorting)

        return await tinybird_query.get_event_type_stats()

    async def get_event_ids_and_count(
        self,
        *,
        organization_id: UUID | Sequence[UUID],
        limit: int,
        offset: int,
        descending: bool = True,
        event_id: UUID | None = None,
        start_timestamp: datetime | None = None,
        end_timestamp: datetime | None = None,
        customer_id: Sequence[UUID] | None = None,
        cross_external_customer_ids: Sequence[str] = (),
        external_customer_id: Sequence[str] | None = None,
        cross_customer_ids: Sequence[UUID] = (),
        name: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        event_type_id: UUID | None = None,
        filters: Sequence[Filter] = (),
        metadata: MetadataQuery | None = None,
        query: str | None = None,
        matching_customer_ids: Sequence[UUID] | None = None,
        matching_external_customer_ids: Sequence[str] | None = None,
        numeric_metadata_property: str | None = None,
        depth: int | None = None,
        parent_id: UUID | None = None,
    ) -> tuple[list[str], int]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return [], 0

        tinybird_query = TinybirdEventsQuery(organization_ids)

        if event_id is not None:
            tinybird_query.filter_event_id(event_id)
        if start_timestamp is not None or end_timestamp is not None:
            tinybird_query.filter_timestamp_range(start_timestamp, end_timestamp)
        if customer_id is not None:
            tinybird_query.filter_customer_id_with_cross_ref(
                customer_id, cross_external_customer_ids
            )
        if external_customer_id is not None:
            tinybird_query.filter_external_customer_id_with_cross_ref(
                external_customer_id, cross_customer_ids
            )
        if name is not None:
            tinybird_query.filter_names(name)
        if source is not None:
            tinybird_query.filter_sources(source)
        if event_type_id is not None:
            tinybird_query.filter_event_type_id(event_type_id)
        for query_filter in filters:
            tinybird_query.filter_by_filter(query_filter)
        if metadata is not None:
            tinybird_query.filter_by_metadata(metadata)
        if query is not None:
            tinybird_query.filter_by_query(
                query, matching_customer_ids, matching_external_customer_ids
            )
        if numeric_metadata_property is not None:
            tinybird_query.filter_numeric_metadata_property(numeric_metadata_property)
        if depth is not None:
            tinybird_query.filter_by_depth(depth, parent_id)
        elif parent_id is not None:
            tinybird_query.filter_parent_id(parent_id)

        return await tinybird_query.get_event_ids_and_count(limit, offset, descending)

    async def event_exists(
        self, organization_id: UUID | Sequence[UUID], event_id: UUID
    ) -> bool:
        _, count = await self.get_event_ids_and_count(
            organization_id=organization_id,
            limit=1,
            offset=0,
            descending=True,
            event_id=event_id,
        )
        return count > 0

    async def get_descendant_aggregates(
        self,
        organization_id: UUID | Sequence[UUID],
        ancestor_id: UUID,
        aggregate_fields: Sequence[str],
    ) -> tuple[int, dict[str, float]]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return 0, {field.replace(".", "_"): 0.0 for field in aggregate_fields}

        tinybird_query = TinybirdEventsQuery(organization_ids)
        tinybird_query.filter_has_ancestor(ancestor_id)
        return await tinybird_query.get_descendant_aggregates(aggregate_fields)

    async def get_timeseries_occurrences(
        self,
        *,
        organization_id: UUID,
        start_timestamp: datetime,
        end_timestamp: datetime,
        interval: str,
        timezone: str,
        aggregate_field: str = "_cost.amount",
        customer_id: Sequence[UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        name: Sequence[str] | None = None,
        event_type_id: UUID | None = None,
    ) -> list[TinybirdTimeseriesBucket]:
        return await get_timeseries_occurrences(
            organization_id,
            start_timestamp,
            end_timestamp,
            interval,
            timezone,
            aggregate_field=aggregate_field,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            name=name,
            event_type_id=event_type_id,
        )

    @staticmethod
    def _apply_ordering(
        tinybird_query: TinybirdEventsQuery | TinybirdEventTypesQuery,
        sorting: Sequence[tuple[str, bool]],
    ) -> None:
        for column, descending in sorting:
            tinybird_query.order_by(column, descending)

    @staticmethod
    def _normalize_organization_ids(
        organization_id: UUID | Sequence[UUID] | None,
    ) -> tuple[UUID, ...]:
        if not organization_id:
            return ()

        if isinstance(organization_id, UUID):
            return (organization_id,)

        return tuple(dict.fromkeys(organization_id))
