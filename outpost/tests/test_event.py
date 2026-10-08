import typing
from datetime import UTC, datetime

import pytest

from outpost.event import EventCreate


@pytest.mark.parametrize(
    ("property", "expected"),
    [
        ("timestamp", 1767225600),
        ("name", "usage"),
        ("source", "user"),
        ("external_customer_id", "metadata_customer"),
        ("tokens", 10),
        ("missing", None),
    ],
)
def test_get_property(property: str, expected: typing.Any) -> None:
    event = EventCreate(
        timestamp=datetime(2026, 1, 1, tzinfo=UTC),
        name="usage",
        external_customer_id="customer",
        metadata={"external_customer_id": "metadata_customer", "tokens": 10},
    )

    assert event.get_property(property) == expected
