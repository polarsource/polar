import uuid
from datetime import UTC, datetime, timezone


def utc_now() -> datetime:
    return datetime.now(UTC)


def generate_uuid() -> uuid.UUID:
    return uuid.uuid4()
