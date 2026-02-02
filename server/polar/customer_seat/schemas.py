from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator, model_validator
from sqlalchemy import inspect

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import Schema, TimestampedSchema
from polar.member.schemas import Member
from polar.models.customer_seat import SeatStatus


class SeatAssign(Schema):
    subscription_id: UUID | None = Field(
        None,
        description="Subscription ID. Required if checkout_id and order_id are not provided.",
    )
    checkout_id: UUID | None = Field(
        None,
        description="Checkout ID. Used to look up subscription or order from the checkout page.",
    )
    order_id: UUID | None = Field(
        None,
        description="Order ID for one-time purchases. Required if subscription_id and checkout_id are not provided.",
    )
    email: EmailStrDNS | None = Field(
        None, description="Email of the customer to assign the seat to"
    )
    external_customer_id: str | None = Field(
        None, description="External customer ID for the seat assignment"
    )
    customer_id: UUID | None = Field(
        None, description="Customer ID for the seat assignment"
    )
    external_member_id: str | None = Field(
        None,
        description=(
            "External member ID for the seat assignment. "
            "Only supported when member_model_enabled is true. "
            "Can be used alone (lookup existing member) or with email (create/validate member)."
        ),
    )
    member_id: UUID | None = Field(
        None,
        description=(
            "Member ID for the seat assignment. "
            "Only supported when member_model_enabled is true."
        ),
    )
    metadata: dict[str, Any] | None = Field(
        None, description="Additional metadata for the seat (max 10 keys, 1KB total)"
    )
    immediate_claim: bool = Field(
        default=False,
        description="If true, the seat will be immediately claimed without sending an invitation email. API-only feature.",
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
        # Validate exactly one seat source
        seat_source_count = sum(
            1
            for x in [self.subscription_id, self.checkout_id, self.order_id]
            if x is not None
        )
        if seat_source_count != 1:
            raise ValueError(
                "Exactly one of subscription_id, checkout_id, or order_id must be provided"
            )

        # Count identifier groups
        legacy_count = sum(
            1 for x in [self.external_customer_id, self.customer_id] if x is not None
        )
        member_count = sum(
            1 for x in [self.external_member_id, self.member_id] if x is not None
        )
        has_email = self.email is not None
        total = legacy_count + member_count + (1 if has_email else 0)

        # At least one identifier required
        if total == 0:
            raise ValueError(
                "At least one of email, external_customer_id, customer_id, "
                "external_member_id, or member_id must be provided"
            )

        # Cannot mix legacy and member identifiers
        if legacy_count > 0 and member_count > 0:
            raise ValueError(
                "Cannot combine external_customer_id/customer_id with "
                "external_member_id/member_id"
            )

        # Cannot provide both external_member_id and member_id
        if member_count > 1:
            raise ValueError("Cannot provide both external_member_id and member_id")

        # Legacy path: exactly one of email, external_customer_id, customer_id
        if legacy_count > 0 and legacy_count + (1 if has_email else 0) != 1:
            raise ValueError(
                "Exactly one of email, external_customer_id, or "
                "customer_id must be provided"
            )

        # member_id cannot be combined with email
        if self.member_id is not None and has_email:
            raise ValueError("Cannot combine member_id with email")

        return self


class SeatClaim(Schema):
    invitation_token: str = Field(..., description="Invitation token to claim the seat")


class CustomerSeat(TimestampedSchema):
    id: UUID = Field(..., description="The seat ID")
    subscription_id: UUID | None = Field(
        None, description="The subscription ID (for recurring seats)"
    )
    order_id: UUID | None = Field(
        None, description="The order ID (for one-time purchase seats)"
    )
    status: SeatStatus = Field(..., description="Status of the seat")
    customer_id: UUID | None = Field(
        None,
        description=(
            "The customer ID. When member_model_enabled is true, this is the billing "
            "customer (purchaser). When false, this is the seat member customer."
        ),
    )
    member_id: UUID | None = Field(
        None, description="The member ID of the seat occupant"
    )
    member: Member | None = Field(
        None, description="The member associated with this seat"
    )
    email: str | None = Field(
        None,
        description="Email of the seat member (set when member_model_enabled is true)",
    )
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
            # For dict data - priority: email > member.email > customer.email
            if "email" in data and data["email"]:
                data["customer_email"] = data["email"]
            elif "member" in data and data["member"]:
                data["customer_email"] = data.get("member", {}).get("email")
            elif "customer" in data and data["customer"]:
                data["customer_email"] = data.get("customer", {}).get("email")
            return data
        elif hasattr(data, "__dict__"):
            state = inspect(data)

            # Safely extract member: set to None if not loaded to avoid lazy='raise'
            if "member" in state.unloaded:
                object.__setattr__(data, "member", None)

            # For SQLAlchemy models - check if email is set on the seat first
            # Priority: seat.email > seat.member.email > seat.customer.email
            if hasattr(data, "email") and data.email:
                object.__setattr__(data, "customer_email", data.email)
            else:
                # Try member first
                if "member" not in state.unloaded:
                    if hasattr(data, "member") and data.member:
                        object.__setattr__(data, "customer_email", data.member.email)
                        return data
                # Fall back to customer
                if "customer" not in state.unloaded:
                    if hasattr(data, "customer") and data.customer:
                        object.__setattr__(data, "customer_email", data.customer.email)
        return data


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
