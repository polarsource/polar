from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from polar.kit.time_queries import TimeInterval, get_timestamp_series_cte


@pytest.mark.asyncio
async def test_day_series_stays_on_local_midnight_across_dst_gap(
    session: AsyncSession,
) -> None:
    # Chile springs forward at midnight on 2026-09-06: local 00:00 does not exist.
    tz = ZoneInfo("America/Santiago")
    await session.execute(text("SET LOCAL TIME ZONE 'America/Santiago'"))
    series = get_timestamp_series_cte(
        datetime(2026, 9, 1, tzinfo=tz),
        datetime(2026, 9, 10, 23, 59, 59, tzinfo=tz),
        TimeInterval.day,
    )

    result = await session.execute(select(series.c.timestamp))
    timestamps = [row[0].astimezone(tz) for row in result.all()]

    assert [ts.date().isoformat() for ts in timestamps] == [
        f"2026-09-{d:02d}" for d in range(1, 11)
    ]
    assert all(ts.hour == 0 for ts in timestamps if ts.date() != date(2026, 9, 6))


@pytest.mark.asyncio
async def test_hour_series_steps_through_dst_gap_without_duplicates(
    session: AsyncSession,
) -> None:
    tz = ZoneInfo("America/Santiago")
    await session.execute(text("SET LOCAL TIME ZONE 'America/Santiago'"))
    series = get_timestamp_series_cte(
        datetime(2026, 9, 5, 22, tzinfo=tz),
        datetime(2026, 9, 6, 2, tzinfo=tz),
        TimeInterval.hour,
    )

    result = await session.execute(select(series.c.timestamp))
    timestamps = [row[0].astimezone(tz).isoformat() for row in result.all()]

    assert timestamps == [
        "2026-09-05T22:00:00-04:00",
        "2026-09-05T23:00:00-04:00",
        "2026-09-06T01:00:00-03:00",
        "2026-09-06T02:00:00-03:00",
    ]
