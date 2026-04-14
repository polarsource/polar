from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from polar.integrations.tinybird.service import (
    TinybirdCustomerStat,
    TinybirdEventsQuery,
    TinybirdEventTypesQuery,
    TinybirdEventTypeStats,
    TinybirdPropertyGroupStats,
    TinybirdTimeseriesStats,
    TinybirdVarianceStat,
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
        customer_id: Sequence[UUID] = (),
        external_customer_id: Sequence[str] = (),
        source: Sequence[EventSource] | None = None,
        query: str | None = None,
        sorting: Sequence[tuple[str, bool]] = (),
    ) -> list[EventNameStats]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return []

        tinybird_query = TinybirdEventsQuery(organization_ids)

        if customer_id or external_customer_id:
            tinybird_query.filter_customer(
                customer_ids=customer_id,
                external_customer_ids=external_customer_id,
            )
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
            if customer_id is not None or external_customer_id is not None:
                tinybird_query.filter_customer(
                    customer_ids=customer_id or (),
                    external_customer_ids=external_customer_id or (),
                )
            if root_events:
                tinybird_query.filter_root_events()
            if parent_id is not None:
                tinybird_query.filter_parent_id(parent_id)
            if source is not None:
                tinybird_query.filter_source(source)
        else:
            # TODO: Revisit this to make TinybirdEventTypesQuery
            # accept a list of org ids. It's not super urgent as
            # this is mostly called with a single org.
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
        customer_id: Sequence[UUID] = (),
        external_customer_id: Sequence[str] = (),
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
        if customer_id or external_customer_id:
            tinybird_query.filter_customer(
                customer_ids=customer_id,
                external_customer_ids=external_customer_id,
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
        tinybird_query.filter_self_or_descendant(ancestor_id)
        return await tinybird_query.get_descendant_aggregates(aggregate_fields)

    async def get_batch_descendant_aggregates(
        self,
        organization_id: UUID | Sequence[UUID],
        ancestor_ids: Sequence[UUID],
        aggregate_fields: Sequence[str],
    ) -> dict[str, tuple[int, dict[str, float]]]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids or not ancestor_ids:
            return {}

        tinybird_query = TinybirdEventsQuery(organization_ids)
        return await tinybird_query.get_batch_descendant_aggregates(
            ancestor_ids, aggregate_fields
        )

    async def get_filtered_timeseries(
        self,
        *,
        organization_id: UUID | Sequence[UUID],
        start_timestamp: datetime,
        end_timestamp: datetime,
        interval: str,
        timezone: str,
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        customer_id: Sequence[UUID] = (),
        external_customer_id: Sequence[str] = (),
        name: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        event_type_id: UUID | None = None,
        filters: Sequence[Filter] = (),
        metadata: MetadataQuery | None = None,
        query: str | None = None,
        matching_customer_ids: Sequence[UUID] | None = None,
        matching_external_customer_ids: Sequence[str] | None = None,
        numeric_metadata_property: str | None = None,
    ) -> list[TinybirdTimeseriesStats]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return []

        tinybird_query = self._build_filtered_query(
            organization_ids,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            name=name,
            source=source,
            event_type_id=event_type_id,
            filters=filters,
            metadata=metadata,
            query=query,
            matching_customer_ids=matching_customer_ids,
            matching_external_customer_ids=matching_external_customer_ids,
            numeric_metadata_property=numeric_metadata_property,
        )
        return await tinybird_query.get_timeseries_stats(
            interval, timezone, aggregate_fields
        )

    async def get_filtered_totals(
        self,
        *,
        organization_id: UUID | Sequence[UUID],
        start_timestamp: datetime,
        end_timestamp: datetime,
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        customer_id: Sequence[UUID] = (),
        external_customer_id: Sequence[str] = (),
        name: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        event_type_id: UUID | None = None,
        filters: Sequence[Filter] = (),
        metadata: MetadataQuery | None = None,
        query: str | None = None,
        matching_customer_ids: Sequence[UUID] | None = None,
        matching_external_customer_ids: Sequence[str] | None = None,
        numeric_metadata_property: str | None = None,
    ) -> list[TinybirdTimeseriesStats]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return []

        tinybird_query = self._build_filtered_query(
            organization_ids,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            name=name,
            source=source,
            event_type_id=event_type_id,
            filters=filters,
            metadata=metadata,
            query=query,
            matching_customer_ids=matching_customer_ids,
            matching_external_customer_ids=matching_external_customer_ids,
            numeric_metadata_property=numeric_metadata_property,
        )
        return await tinybird_query.get_totals_stats(aggregate_fields)

    async def get_customer_stats(
        self,
        *,
        organization_id: UUID | Sequence[UUID],
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        start_timestamp: datetime | None = None,
        end_timestamp: datetime | None = None,
        customer_id: Sequence[UUID] = (),
        external_customer_id: Sequence[str] = (),
        limit: int = 200,
    ) -> list[TinybirdCustomerStat]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return []

        tinybird_query = TinybirdEventsQuery(organization_ids)
        if start_timestamp is not None or end_timestamp is not None:
            tinybird_query.filter_timestamp_range(start_timestamp, end_timestamp)
        if customer_id or external_customer_id:
            tinybird_query.filter_customer(
                customer_ids=customer_id,
                external_customer_ids=external_customer_id,
            )

        return await tinybird_query.get_customer_stats(aggregate_fields, limit)

    async def get_variance_events(
        self,
        *,
        organization_id: UUID | Sequence[UUID],
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        start_timestamp: datetime | None = None,
        end_timestamp: datetime | None = None,
        customer_id: Sequence[UUID] = (),
        external_customer_id: Sequence[str] = (),
        name: Sequence[str] | None = None,
        limit: int = 100,
    ) -> list[TinybirdVarianceStat]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return []

        tinybird_query = TinybirdEventsQuery(organization_ids)
        if start_timestamp is not None or end_timestamp is not None:
            tinybird_query.filter_timestamp_range(start_timestamp, end_timestamp)
        if customer_id or external_customer_id:
            tinybird_query.filter_customer(
                customer_ids=customer_id,
                external_customer_ids=external_customer_id,
            )
        if name is not None:
            tinybird_query.filter_names(name)

        return await tinybird_query.get_variance_events(aggregate_fields, limit)

    async def get_property_group_stats(
        self,
        *,
        organization_id: UUID | Sequence[UUID],
        property: str,
        aggregate_fields: Sequence[str] = ("_cost.amount",),
        start_timestamp: datetime | None = None,
        end_timestamp: datetime | None = None,
        customer_id: Sequence[UUID] = (),
        external_customer_id: Sequence[str] = (),
        limit: int = 200,
    ) -> list[TinybirdPropertyGroupStats]:
        organization_ids = self._normalize_organization_ids(organization_id)
        if not organization_ids:
            return []

        tinybird_query = TinybirdEventsQuery(organization_ids)
        if start_timestamp is not None or end_timestamp is not None:
            tinybird_query.filter_timestamp_range(start_timestamp, end_timestamp)
        if customer_id or external_customer_id:
            tinybird_query.filter_customer(
                customer_ids=customer_id,
                external_customer_ids=external_customer_id,
            )

        return await tinybird_query.get_property_group_stats(
            property, aggregate_fields, limit
        )

    @staticmethod
    def _build_filtered_query(
        organization_ids: tuple[UUID, ...],
        *,
        start_timestamp: datetime | None = None,
        end_timestamp: datetime | None = None,
        customer_id: Sequence[UUID] = (),
        external_customer_id: Sequence[str] = (),
        name: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        event_type_id: UUID | None = None,
        filters: Sequence[Filter] = (),
        metadata: MetadataQuery | None = None,
        query: str | None = None,
        matching_customer_ids: Sequence[UUID] | None = None,
        matching_external_customer_ids: Sequence[str] | None = None,
        numeric_metadata_property: str | None = None,
    ) -> TinybirdEventsQuery:
        tinybird_query = TinybirdEventsQuery(organization_ids)
        if start_timestamp is not None or end_timestamp is not None:
            tinybird_query.filter_timestamp_range(start_timestamp, end_timestamp)
        if customer_id or external_customer_id:
            tinybird_query.filter_customer(
                customer_ids=customer_id,
                external_customer_ids=external_customer_id,
            )
        if name is not None:
            tinybird_query.filter_names(name)
        if source is not None:
            tinybird_query.filter_sources(source)
        if event_type_id is not None:
            tinybird_query.filter_event_type_id(event_type_id)
        for f in filters:
            tinybird_query.filter_by_filter(f)
        if metadata is not None:
            tinybird_query.filter_by_metadata(metadata)
        if query is not None:
            tinybird_query.filter_by_query(
                query, matching_customer_ids, matching_external_customer_ids
            )
        if numeric_metadata_property is not None:
            tinybird_query.filter_numeric_metadata_property(numeric_metadata_property)
        return tinybird_query

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
