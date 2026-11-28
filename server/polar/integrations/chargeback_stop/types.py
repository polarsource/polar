from typing import Literal, NotRequired, TypedDict

RETRACTED_ALERT_STATUS = "INVALID"


class ChargebackStopAlert(TypedDict):
    id: str
    status: NotRequired[str]
    created_at: str
    updated_at: str
    integration_transaction_id: str | None
    transaction_refund_outcome: Literal["REFUNDED", "NOT_REFUNDED"]
    transaction_amount_in_cents: int
    transaction_currency_code: str
    transaction_authorised_at: NotRequired[str | None]
    transaction_authorisation_code: NotRequired[str | None]
    transaction_card_last4: NotRequired[str | None]
    transaction_acquirer_reference_number: NotRequired[str | None]
