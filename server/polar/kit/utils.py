import uuid
from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def generate_uuid() -> uuid.UUID:
    return uuid.uuid4()
