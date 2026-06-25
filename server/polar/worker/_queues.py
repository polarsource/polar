from enum import IntEnum, StrEnum

from polar.config import settings


class TaskPriority(IntEnum):
    HIGH = 0
    MEDIUM = 50
    LOW = 100


def _queue_name(name: str) -> str:
    # Vercel Queues topics must not contain underscores, so hyphenate here
    return name.replace("_", "-") if settings.is_vercel() else name


class TaskQueue(StrEnum):
    HIGH_PRIORITY = _queue_name("high_priority")
    MEDIUM_PRIORITY = _queue_name("medium_priority")
    LOW_PRIORITY = _queue_name("low_priority")
    WEBHOOKS = _queue_name("webhooks")
    TINYBIRD = _queue_name("tinybird")
    INVOICES_AND_RECEIPTS = _queue_name("invoices_and_receipts")


__all__ = [
    "TaskPriority",
    "TaskQueue",
]
