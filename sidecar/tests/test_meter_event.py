from datetime import UTC, datetime

from polar.meter.event import BufferedEvent


def test_from_body_defaults_source_to_user() -> None:
    event = BufferedEvent.from_body(
        {"name": "usage", "timestamp": "2026-06-09T10:00:00+00:00"}
    )

    assert event.source == "user"
    assert event.user_metadata == {}


def test_from_body_reads_metadata_and_timestamp() -> None:
    event = BufferedEvent.from_body(
        {
            "name": "usage",
            "timestamp": "2026-06-09T10:00:00+00:00",
            "metadata": {"tokens": 5},
        }
    )

    assert event.name == "usage"
    assert event.user_metadata == {"tokens": 5}
    assert event.timestamp == datetime(2026, 6, 9, 10, 0, tzinfo=UTC)
