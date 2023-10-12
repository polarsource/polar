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


# Stripe Metadata
#
# Setting a value to an empty string will remove the field from Stripe.
# Sending a empty metadata object will remove all metadata from Stripe.
#
# This is why we require issue_id to always be set, to prevent this from happening.
class PaymentIntentMetadata(Schema):
    issue_id: str
    issue_title: str | None = None

    user_id: str | None = None
    user_username: str | None = None
    user_email: str | None = None
    organization_id: str | None = None
    organization_name: str | None = None

    on_behalf_of_organization_id: str | None = None
