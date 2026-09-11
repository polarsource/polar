"""Framing origins observed on the checkout page, read from Logfire.

`uncovered_hosts` builds on `Checkout.embed_origin`, a value the merchant
declares. It therefore misses anyone who frames the checkout without declaring
anything — the population `frame-ancestors` would break. The embed policy
endpoint logs the `Referer` of every framed checkout load instead, which is set
by the browser and cannot be shaped by the page.

This reads those log lines back, shaped like the observations
`set_organization_embed_hosts` already classifies: `(origin, loads, last_seen)`
per organization.

Logfire keeps 30 days and answers at most 14 days per query, so the window is
walked in slices and merged. It also caps a query at 100 rows unless asked
otherwise, which silently loses organizations, so the limit is set and a slice
that comes back full is refused rather than trusted.
"""

import asyncio
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from logfire.query_client import AsyncLogfireQueryClient

RETENTION = timedelta(days=30)
MAX_SLICE = timedelta(days=14)
MAX_ROWS = 10_000
MESSAGE = "Embedded checkout framing policy resolved"

OUR_ORIGINS = ("https://polar.sh", "https://sandbox.polar.sh")

Observation = tuple[str, int, datetime]

_QUERY = f"""
SELECT
    attributes->>'organization_id' AS organization_id,
    attributes->>'frame_origin' AS frame_origin,
    count(*) AS loads,
    max(start_timestamp) AS last_seen
FROM records
WHERE message = '{MESSAGE}'
  AND attributes->>'fetch_dest' = 'iframe'
  AND attributes->>'frame_origin' IS NOT NULL
  AND attributes->>'frame_origin' NOT IN {tuple(OUR_ORIGINS)}
GROUP BY 1, 2
"""


class ObservationsTruncated(Exception):
    def __init__(self, start: datetime, end: datetime) -> None:
        super().__init__(
            f"Logfire returned {MAX_ROWS} rows for {start.date()}..{end.date()}, "
            "so the slice is capped and organizations are missing. "
            "Raise MAX_ROWS or shorten the window."
        )


def _slices(window: timedelta, *, now: datetime) -> list[tuple[datetime, datetime]]:
    """Whole window, cut to what a single query is allowed to span."""
    start = now - window
    out: list[tuple[datetime, datetime]] = []
    while start < now:
        end = min(start + MAX_SLICE, now)
        out.append((start, end))
        start = end
    return out


def _merge(rows: list[dict[str, Any]]) -> dict[UUID, list[Observation]]:
    """Slices overlap on nothing, so counts add and the latest sighting wins."""
    merged: dict[UUID, dict[str, Observation]] = defaultdict(dict)
    for row in rows:
        organization_id = UUID(row["organization_id"])
        origin = row["frame_origin"]
        loads = int(row["loads"])
        last_seen = datetime.fromisoformat(row["last_seen"])
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=UTC)

        seen = merged[organization_id].get(origin)
        if seen is None:
            merged[organization_id][origin] = (origin, loads, last_seen)
        else:
            merged[organization_id][origin] = (
                origin,
                seen[1] + loads,
                max(seen[2], last_seen),
            )

    return {
        organization_id: sorted(observations.values(), key=lambda o: (-o[1], o[0]))
        for organization_id, observations in merged.items()
    }


async def load(
    read_token: str, window: timedelta = RETENTION
) -> dict[UUID, list[Observation]]:
    now = datetime.now(UTC)
    slices = _slices(window, now=now)
    async with AsyncLogfireQueryClient(read_token=read_token) as client:
        results = await asyncio.gather(
            *(
                client.query_json_rows(
                    _QUERY,
                    min_timestamp=start,
                    max_timestamp=end,
                    environment="production",
                    limit=MAX_ROWS,
                )
                for start, end in slices
            )
        )

    rows: list[dict[str, Any]] = []
    for (start, end), result in zip(slices, results, strict=True):
        if len(result["rows"]) >= MAX_ROWS:
            raise ObservationsTruncated(start, end)
        rows.extend(result["rows"])

    return _merge(rows)
