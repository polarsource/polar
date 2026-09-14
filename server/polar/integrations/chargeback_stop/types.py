from typing import Literal, NotRequired, TypedDict

RETRACTED_ALERT_STATUS = "INVALID"


class ChargebackStopAlert(TypedDict):
    id: str
    status: NotRequired[str]
    created_at: str
    updated_at: str
    integration_transaction_id: str
    transaction_refund_outcome: Literal["REFUNDED", "NOT_REFUNDED"]
    transaction_amount_in_cents: int
    transaction_currency_code: str
