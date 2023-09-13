from typing import Optional

from polar.kit.schemas import Schema


class CreateIntent(Schema):
    issue_id: str
    amount: int


class PaymentIntentSuccessWebhook(Schema):
    id: str  # A payment intent id (pi_)
    amount: int
    amount_received: int
    customer: Optional[str] = None
    invoice: Optional[str] = None  # A invoice ID (in_)
    latest_charge: str  # A charge ID (ch_)
    status: str  # "succeeded"
