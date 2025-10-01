from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field, model_validator

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.customer_seat import SeatStatus


class SeatAssign(Schema):
    subscription_id: UUID | None = Field(
        None,
        description="Subscription ID. Required if checkout_id is not provided.",
    )
    checkout_id: UUID | None = Field(
        None,
        description="Checkout ID. Used to look up subscription. Required if subscription_id is not provided.",
    )
    email: str | None = Field(
        None, description="Email of the customer to assign the seat to"
    )
    external_customer_id: str | None = Field(
        None, description="External customer ID for the seat assignment"
    )
    customer_id: UUID | None = Field(
        None, description="Customer ID for the seat assignment"
    )
    metadata: dict[str, Any] | None = Field(
        None, description="Additional metadata for the seat"
    )

    @model_validator(mode="after")
    def validate_identifiers(self) -> "SeatAssign":
        subscription_identifiers = [self.subscription_id, self.checkout_id]
        subscription_count = sum(
            1 for identifier in subscription_identifiers if identifier is not None
        )

        if subscription_count != 1:
            raise ValueError(
                "Exactly one of subscription_id or checkout_id must be provided"
            )

        customer_identifiers = [self.email, self.external_customer_id, self.customer_id]
        customer_count = sum(
            1 for identifier in customer_identifiers if identifier is not None
        )

        if customer_count != 1:
            raise ValueError(
                "Exactly one of email, external_customer_id, or customer_id must be provided"
            )

        return self


class SeatClaim(Schema):
    invitation_token: str = Field(..., description="Invitation token to claim the seat")


class CustomerSeat(TimestampedSchema):
    id: UUID = Field(..., description="The seat ID")
    subscription_id: UUID = Field(..., description="The subscription ID")
    status: SeatStatus = Field(..., description="Status of the seat")
    customer_id: UUID | None = Field(None, description="The assigned customer ID")
    claimed_at: datetime | None = Field(None, description="When the seat was claimed")
    revoked_at: datetime | None = Field(None, description="When the seat was revoked")
    seat_metadata: dict[str, Any] | None = Field(
        None, description="Additional metadata for the seat"
    )

    class Config:
        from_attributes = True


class SeatsList(Schema):
    seats: list[CustomerSeat] = Field(..., description="List of seats")
    available_seats: int = Field(..., description="Number of available seats")
    total_seats: int = Field(
        ..., description="Total number of seats for the subscription"
    )


CustomerSeatID = UUID
