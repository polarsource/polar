from datetime import timedelta

from pydantic import Field, field_validator

from polar.kit.address import Address, AddressInput
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


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

    @field_validator("payout_interval", mode="before")
    @classmethod
    def _payout_interval_to_seconds(cls, value: timedelta | int) -> int:
        if isinstance(value, timedelta):
            return int(value.total_seconds())
        return value


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
