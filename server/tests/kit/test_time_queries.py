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
