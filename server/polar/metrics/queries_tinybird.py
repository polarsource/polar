from collections.abc import Sequence
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID

from polar.integrations.tinybird.client import client as tinybird_client
from polar.kit.time_queries import TimeInterval


class TinybirdQuery(StrEnum):
    mrr = "mrr"
    events = "events"
    costs = "costs"


def _format_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _join_uuids(ids: Sequence[UUID]) -> str:
    return ",".join(str(id) for id in ids)


def _join_strings(values: Sequence[str]) -> str:
    return ",".join(values)


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
    now: datetime | None = None,
    product_id: Sequence[UUID] | None = None,
    customer_id: Sequence[UUID] | None = None,
    external_customer_id: Sequence[str] | None = None,
    billing_type: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Query the combined metrics endpoint.

    Args:
        metric_types: Which metric types to include (costs, events, mrr)
        organization_id: Organization UUIDs to filter by
        start: Start of the interval window (truncated to interval boundary)
        end: End of the interval window
        interval: Time interval (day, week, month, year)
        timezone: Timezone string
        bounds_start: Actual start bound for filtering (defaults to start)
        bounds_end: Actual end bound for filtering (defaults to end)
        now: Current datetime for MRR calculations (required if mrr in metric_types)
        product_id: Optional product UUIDs to filter by
        customer_id: Optional customer UUIDs to filter by
        external_customer_id: Optional external customer IDs to filter by
        billing_type: Optional billing types to filter by
    """
    b_start = bounds_start or start
    b_end = bounds_end or end

    params: dict[str, str] = {
        "metric_types": ",".join(mt.value for mt in metric_types),
        "interval": interval.value,
        "org_ids": _join_uuids(organization_id),
        "start_dt": _format_dt(start),
        "end_dt": _format_dt(end),
        "bounds_start": _format_dt(b_start),
        "bounds_end": _format_dt(b_end),
        "tz": timezone,
    }

    if TinybirdQuery.events in metric_types or TinybirdQuery.mrr in metric_types:
        params["buffer_start"] = _format_dt(b_start - timedelta(days=1))
        params["buffer_end"] = _format_dt(b_end + timedelta(days=1))

    if TinybirdQuery.mrr in metric_types:
        if now is None:
            raise ValueError("now is required when querying mrr metrics")
        params["now_dt"] = _format_dt(now)

    if product_id is not None:
        params["product_ids"] = _join_uuids(product_id)

    if customer_id is not None:
        params["customer_ids"] = _join_uuids(customer_id)

    if external_customer_id is not None:
        params["external_customer_ids"] = _join_strings(external_customer_id)

    if billing_type is not None:
        params["billing_types"] = _join_strings(billing_type)

    return await tinybird_client.endpoint("metrics", params)
