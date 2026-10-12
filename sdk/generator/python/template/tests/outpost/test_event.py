import datetime

import pytest

from polar.outpost.event import Event

TIMESTAMP = datetime.datetime(2026, 10, 12, 12, 4, 59, tzinfo=datetime.UTC)


def test_naive_timestamp_is_rejected() -> None:
    with pytest.raises(ValueError, match="timezone"):
        Event("call", "customer", TIMESTAMP.replace(tzinfo=None))

