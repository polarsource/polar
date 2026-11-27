from enum import StrEnum
from typing import TypedDict

RETRY_NOW_NOTIFICATION_TYPE = "RETRY_NOW"


class RetryOutcome(StrEnum):
    succeeded = "SUCCEEDED"
    failed = "FAILED"
    not_attempted = "NOT_ATTEMPTED"


class PaymentRetryAlert(TypedDict):
    id: str
    notification_type: str
    network_transaction_id: str
