import asyncio
from collections.abc import Sequence
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID

from polar.integrations.tinybird.client import client as tinybird_client
from polar.kit.time_queries import TimeInterval


class TinybirdQuery(StrEnum):
    events = "events"
    costs = "costs"
    cancellations = "cancellations"
    revenue = "revenue"


def _format_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _join_uuids(ids: Sequence[UUID]) -> str:
    return ",".join(str(id) for id in ids)


def _join_strings(values: Sequence[str]) -> str:
    return ",".join(values)


async def _query_events_metrics(
    params: dict[str, str],
) -> list[dict[str, Any]]:
    return await tinybird_client.endpoint("metrics_events", params)


async def _query_costs_metrics(
    params: dict[str, str],
) -> list[dict[str, Any]]:
    return await tinybird_client.endpoint("metrics_costs", params)


async def _query_cancellations_metrics(
    params: dict[str, str],
) -> list[dict[str, Any]]:
    return await tinybird_client.endpoint("metrics_cancellations", params)


async def _query_revenue_metrics(
    params: dict[str, str],
) -> list[dict[str, Any]]:
    return await tinybird_client.endpoint("metrics_revenue", params)


def _merge_results(
    metric_types: Sequence[TinybirdQuery],
    events_data: list[dict[str, Any]] | None,
    costs_data: list[dict[str, Any]] | None,
    cancellations_data: list[dict[str, Any]] | None,
    revenue_data: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Merge results from parallel endpoint calls by timestamp."""
    events_by_ts: dict[str, dict[str, Any]] = {}
    costs_by_ts: dict[str, dict[str, Any]] = {}
    cancellations_by_ts: dict[str, dict[str, Any]] = {}
    revenue_by_ts: dict[str, dict[str, Any]] = {}

    if events_data:
        events_by_ts = {row["timestamp"]: row for row in events_data}
    if costs_data:
        costs_by_ts = {row["timestamp"]: row for row in costs_data}
    if cancellations_data:
        cancellations_by_ts = {row["timestamp"]: row for row in cancellations_data}
    if revenue_data:
        revenue_by_ts = {row["timestamp"]: row for row in revenue_data}

    all_timestamps = (
        set(events_by_ts.keys())
        | set(costs_by_ts.keys())
        | set(cancellations_by_ts.keys())
        | set(revenue_by_ts.keys())
    )

    result: list[dict[str, Any]] = []
    for ts in sorted(all_timestamps):
        row: dict[str, Any] = {"timestamp": ts}

        if TinybirdQuery.events in metric_types and ts in events_by_ts:
            events_row = events_by_ts[ts]
            for key, value in events_row.items():
                if key != "timestamp":
                    row[key] = value

        if TinybirdQuery.costs in metric_types and ts in costs_by_ts:
            costs_row = costs_by_ts[ts]
            for key, value in costs_row.items():
                if key != "timestamp":
                    row[key] = value

        if TinybirdQuery.cancellations in metric_types and ts in cancellations_by_ts:
            cancellations_row = cancellations_by_ts[ts]
            for key, value in cancellations_row.items():
                if key != "timestamp":
                    row[key] = value

        if TinybirdQuery.revenue in metric_types and ts in revenue_by_ts:
            revenue_row = revenue_by_ts[ts]
            for key, value in revenue_row.items():
                if key != "timestamp":
                    row[key] = value

        result.append(row)

    return result


async def query_metrics(
    *,
    metric_types: Sequence[TinybirdQuery],
    organization_id: Sequence[UUID],
    start: datetime,
    end: datetime,
    interval: TimeInterval,
    timezone: str,
    bounds_start: datetime | None = None,
    bounds_end: datetime | None = None,
    product_id: Sequence[UUID] | None = None,
    customer_id: Sequence[UUID] | None = None,
    external_customer_id: Sequence[str] | None = None,
    billing_type: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Query metrics endpoints in parallel.

    Calls separate endpoints for each metric type in parallel and merges
    the results by timestamp.

    Args:
        metric_types: Which metric types to include (events, costs, cancellations, revenue)
        organization_id: Organization UUIDs to filter by
        start: Start of the interval window (truncated to interval boundary)
        end: End of the interval window
        interval: Time interval (day, week, month, year)
        timezone: Timezone string
        bounds_start: Actual start bound for filtering (defaults to start)
        bounds_end: Actual end bound for filtering (defaults to end)
        product_id: Optional product UUIDs to filter by
        customer_id: Optional customer UUIDs to filter by
        external_customer_id: Optional external customer IDs to filter by
        billing_type: Optional billing types to filter by
    """
    b_start = bounds_start or start
    b_end = bounds_end or end

    base_params: dict[str, str] = {
        "interval": interval.value,
        "org_ids": _join_uuids(organization_id),
        "start_dt": _format_dt(start),
        "end_dt": _format_dt(end),
        "bounds_start": _format_dt(b_start),
        "bounds_end": _format_dt(b_end),
        "tz": timezone,
    }

    if product_id is not None:
        base_params["product_ids"] = _join_uuids(product_id)

    if customer_id is not None:
        base_params["customer_ids"] = _join_uuids(customer_id)

    if external_customer_id is not None:
        base_params["external_customer_ids"] = _join_strings(external_customer_id)

    if billing_type is not None:
        base_params["billing_types"] = _join_strings(billing_type)

    tasks: list[asyncio.Task[list[dict[str, Any]]]] = []
    task_types: list[TinybirdQuery] = []

    if TinybirdQuery.events in metric_types:
        events_params = base_params.copy()
        events_params["buffer_start"] = _format_dt(start - timedelta(days=1))
        events_params["buffer_end"] = _format_dt(end + timedelta(days=1))
        tasks.append(asyncio.create_task(_query_events_metrics(events_params)))
        task_types.append(TinybirdQuery.events)

    if TinybirdQuery.costs in metric_types:
        tasks.append(asyncio.create_task(_query_costs_metrics(base_params.copy())))
        task_types.append(TinybirdQuery.costs)

    if TinybirdQuery.cancellations in metric_types:
        cancellations_params = base_params.copy()
        cancellations_params.pop("external_customer_ids", None)
        tasks.append(
            asyncio.create_task(_query_cancellations_metrics(cancellations_params))
        )
        task_types.append(TinybirdQuery.cancellations)

    if TinybirdQuery.revenue in metric_types:
        tasks.append(asyncio.create_task(_query_revenue_metrics(base_params.copy())))
        task_types.append(TinybirdQuery.revenue)

    if not tasks:
        return []

    results = await asyncio.gather(*tasks)

    events_data: list[dict[str, Any]] | None = None
    costs_data: list[dict[str, Any]] | None = None
    cancellations_data: list[dict[str, Any]] | None = None
    revenue_data: list[dict[str, Any]] | None = None

    for i, task_type in enumerate(task_types):
        if task_type == TinybirdQuery.events:
            events_data = results[i]
        elif task_type == TinybirdQuery.costs:
            costs_data = results[i]
        elif task_type == TinybirdQuery.cancellations:
            cancellations_data = results[i]
        elif task_type == TinybirdQuery.revenue:
            revenue_data = results[i]

    return _merge_results(
        metric_types,
        events_data,
        costs_data,
        cancellations_data,
        revenue_data,
    )
