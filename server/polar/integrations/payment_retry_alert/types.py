from enum import StrEnum
from typing import TypedDict

RETRY_NOW_NOTIFICATION_TYPE = "RETRY_NOW"


class RetryOutcome(StrEnum):
    succeeded = "SUCCEEDED"
    failed = "FAILED"
    not_attempted = "NOT_ATTEMPTED"


class PaymentRetryAlert(TypedDict):
    id: str
    enrolment_mid: str
    card_scheme: str
    notification_type: str
    transaction_time: str
    transaction_amount_in_cents: int | None
    transaction_currency: str
    network_transaction_id: str
    card_last_four: str
