import json
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import Schema


class CustomerSeatAssign(Schema):
    subscription_id: UUID | None = Field(
        None,
        description="Subscription ID. Exactly one of subscription_id, order_id, or checkout_id must be provided.",
    )
    order_id: UUID | None = Field(
        None,
        description="Order ID for one-time purchases. Exactly one of subscription_id, order_id, or checkout_id must be provided.",
    )
    checkout_id: UUID | None = Field(
        None,
        description="Checkout ID. Resolves to the subscription or order produced by the checkout.",
    )
    email: EmailStrDNS = Field(
        ..., description="Email of the customer to assign the seat to"
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
        if len(json.dumps(v)) > 1024:
            raise ValueError("Metadata size cannot exceed 1KB")
        return v

    @model_validator(mode="after")
    def validate_seat_source(self) -> "CustomerSeatAssign":
        source_count = sum(
            1
            for x in [self.subscription_id, self.order_id, self.checkout_id]
            if x is not None
        )
        if source_count != 1:
            raise ValueError(
                "Exactly one of subscription_id, order_id, or checkout_id must be provided"
            )
        return self
