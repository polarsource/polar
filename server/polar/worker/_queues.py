from enum import IntEnum, StrEnum


class TaskPriority(IntEnum):
    HIGH = 0
    MEDIUM = 50
    LOW = 100


class TaskQueue(StrEnum):
    HIGH_PRIORITY = "high_priority"
    MEDIUM_PRIORITY = "medium_priority"
    LOW_PRIORITY = "low_priority"
    WEBHOOKS = "webhooks"
    TINYBIRD = "tinybird"
    INVOICES_AND_RECEIPTS = "invoices_and_receipts"


__all__ = [
    "TaskPriority",
    "TaskQueue",
]
