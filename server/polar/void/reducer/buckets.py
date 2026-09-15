from datetime import UTC, datetime, timedelta

BUCKET_SIZE = timedelta(minutes=5)


def bucket_start(timestamp: datetime) -> datetime:
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=UTC)
    timestamp = timestamp.astimezone(UTC)
    return timestamp.replace(
        minute=timestamp.minute - timestamp.minute % 5, second=0, microsecond=0
    )
