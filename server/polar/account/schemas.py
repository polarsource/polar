from datetime import datetime

from pydantic import Field

from polar.kit.address import Address, AddressInput
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class Account(TimestampedSchema, IDSchema):
    billing_name: str | None
    billing_address: Address | None
    billing_additional_info: str | None
    billing_notes: str | None
    currency: str
    credit_balance: int
    next_payout_at: datetime | None = Field(
        default=None,
        description=(
            "Timestamp at which the next payout can be requested, if the "
            "payout interval limit has been reached. `null` if a payout can "
            "be requested immediately."
        ),
    )


class AccountUpdate(Schema):
    billing_name: str | None = Field(
        default=None,
        description="Billing name that should appear on the reverse invoice.",
    )
    billing_address: AddressInput | None = Field(
        default=None,
        description="Billing address that should appear on the reverse invoice.",
    )
    billing_additional_info: str | None = Field(
        default=None,
        description="Additional information that should appear on the reverse invoice.",
    )
    billing_notes: str | None = Field(
        default=None,
        description="Notes that should appear on the reverse invoice.",
    )
