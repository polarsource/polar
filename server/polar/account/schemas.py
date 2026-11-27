from datetime import timedelta

from pydantic import MISSING, Field, field_validator

from polar.kit.address import Address, AddressInput
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.kit.versioning import Omissible


class Account(TimestampedSchema, IDSchema):
    billing_name: str | None
    billing_address: Address | None
    billing_additional_info: str | None
    billing_notes: str | None
    currency: str
    credit_balance: int
    payout_interval: int = Field(
        description="Minimum delay, in seconds, between two payout requests.",
    )
    payout_transaction_delay: timedelta = Field(
        description="Delay after which a transaction becomes available for payout."
    )

    @field_validator("payout_interval", mode="before")
    @classmethod
    def _payout_interval_to_seconds(cls, value: timedelta | int) -> int:
        if isinstance(value, timedelta):
            return int(value.total_seconds())
        return value


class AccountUpdate(Schema):
    billing_name: Omissible[str | None] = Field(
        MISSING,
        description="Billing name that should appear on the reverse invoice.",
    )
    billing_address: Omissible[AddressInput | None] = Field(
        default=MISSING,
        description="Billing address that should appear on the reverse invoice.",
    )
    billing_additional_info: Omissible[str | None] = Field(
        default=MISSING,
        description="Additional information that should appear on the reverse invoice.",
    )
    billing_notes: Omissible[str | None] = Field(
        default=MISSING,
        description="Notes that should appear on the reverse invoice.",
    )
