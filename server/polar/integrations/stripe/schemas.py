from enum import StrEnum
from typing import Literal
from uuid import UUID

from polar.kit.schemas import Schema


class PaymentIntentSuccessWebhook(Schema):
    id: str  # A payment intent id (pi_)
    amount: int
    amount_received: int
    customer: str | None = None
    invoice: str | None = None  # A invoice ID (in_)
    latest_charge: str  # A charge ID (ch_)
    status: str  # "succeeded"


class ProductType(StrEnum):
    pledge = "pledge"


class PaymentIntentMetadata(Schema):
    """
    Stripe Metadata

    Setting a value to an empty string will remove the field from Stripe.
    Sending a empty metadata object will remove all metadata from Stripe.

    This is why we always set polar_not_empty to an empty string, to prevent us from
    accidentally unsetting all metadata.
    """

    # Safe guards us from accidentally sending an empty metadata object
    polar_not_empty: str = ""

    type: ProductType


class PledgePaymentIntentMetadata(PaymentIntentMetadata):
    type: Literal[ProductType.pledge] = ProductType.pledge

    issue_id: UUID | None = None
    issue_title: str | None = None

    user_id: UUID | None = None
    user_username: str | None = None
    user_email: str | None = None
    organization_id: UUID | None = None
    organization_name: str | None = None

    # Set to empty string to unset the value
    on_behalf_of_organization_id: UUID | Literal[""] | None = None
