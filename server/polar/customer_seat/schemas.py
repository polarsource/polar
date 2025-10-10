from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import EmailStr, Field, field_validator, model_validator
from sqlalchemy import inspect

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
    email: EmailStr | None = Field(
        None, description="Email of the customer to assign the seat to"
    )
    external_customer_id: str | None = Field(
        None, description="External customer ID for the seat assignment"
    )
    customer_id: UUID | None = Field(
        None, description="Customer ID for the seat assignment"
    )
    metadata: dict[str, Any] | None = Field(
        None, description="Additional metadata for the seat (max 10 keys, 1KB total)"
    )

    @field_validator("metadata")
    @classmethod
    def validate_metadata(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is None:
            return v
        if len(v) > 10:
            raise ValueError("Metadata cannot have more than 10 keys")
        import json

        if len(json.dumps(v)) > 1024:  # 1KB limit
            raise ValueError("Metadata size cannot exceed 1KB")
        return v

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
    customer_email: str | None = Field(None, description="The assigned customer email")
    invitation_token_expires_at: datetime | None = Field(
        None, description="When the invitation token expires"
    )
    claimed_at: datetime | None = Field(None, description="When the seat was claimed")
    revoked_at: datetime | None = Field(None, description="When the seat was revoked")
    seat_metadata: dict[str, Any] | None = Field(
        None, description="Additional metadata for the seat"
    )

    @model_validator(mode="before")
    @classmethod
    def extract_customer_email(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # For dict data
            if "customer" in data and data["customer"]:
                data["customer_email"] = data.get("customer", {}).get("email")
            return data
        elif hasattr(data, "__dict__"):
            # For SQLAlchemy models - check if customer is loaded
            state = inspect(data)
            if "customer" not in state.unloaded:
                # Customer is loaded, we can extract the email
                # But we need to let Pydantic handle the model conversion
                # We'll just add the customer_email field if customer is available
                if hasattr(data, "customer") and data.customer:
                    # Add customer_email as a temporary attribute
                    object.__setattr__(data, "customer_email", data.customer.email)
        return data

    class Config:
        from_attributes = True


class SeatsList(Schema):
    seats: list[CustomerSeat] = Field(..., description="List of seats")
    available_seats: int = Field(..., description="Number of available seats")
    total_seats: int = Field(
        ..., description="Total number of seats for the subscription"
    )


class SeatClaimInfo(Schema):
    """
    Read-only information about a seat claim invitation.
    Safe for email scanners - no side effects when fetched.
    """

    product_name: str = Field(..., description="Name of the product")
    product_id: UUID = Field(..., description="ID of the product")
    organization_name: str = Field(..., description="Name of the organization")
    organization_slug: str = Field(..., description="Slug of the organization")
    customer_email: str = Field(
        ..., description="Email of the customer assigned to this seat"
    )
    can_claim: bool = Field(..., description="Whether the seat can be claimed")


class CustomerSeatClaimResponse(Schema):
    """Response after successfully claiming a seat."""

    seat: CustomerSeat = Field(..., description="The claimed seat")
    customer_session_token: str = Field(
        ..., description="Session token for immediate customer portal access"
    )


CustomerSeatID = UUID
