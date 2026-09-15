from datetime import UTC, datetime, timedelta, timezone

import pytest

from polar.void.reducer.buckets import bucket_start


@pytest.mark.parametrize(
    "timestamp",
    [
        datetime(2026, 9, 15, 10, 14, 59, 999999, tzinfo=UTC).replace(tzinfo=None),
        datetime(2026, 9, 15, 10, 14, 59, 999999, tzinfo=UTC),
        datetime(2026, 9, 15, 12, 14, 59, 999999, tzinfo=timezone(timedelta(hours=2))),
    ],
)
def test_bucket_uses_five_minute_utc_boundaries(timestamp: datetime) -> None:
    assert bucket_start(timestamp) == datetime(2026, 9, 15, 10, 10, tzinfo=UTC)
