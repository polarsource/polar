from datetime import datetime
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.customer.schemas.customer import CustomerBase
from polar.exceptions import ResourceNotFound
from polar.kit.schemas import (
    ORDER_ID_EXAMPLE,
    PAYMENT_ID_EXAMPLE,
    IDSchema,
    TimestampedSchema,
)
from polar.models.dispute import DisputeStatus

DisputeID = Annotated[UUID4, Path(description="The dispute ID.")]


class DisputeCustomer(CustomerBase): ...


DisputeNotFound = {
    "description": "Dispute not found.",
    "model": ResourceNotFound.schema(),
}


class DisputeBase(IDSchema, TimestampedSchema):
    status: Annotated[
        DisputeStatus,
        Field(
            description=(
                "Status of the dispute. "
                "`prevented` means we issued a refund before the dispute was escalated, "
                "avoiding any fees."
            ),
            examples=[DisputeStatus.needs_response, DisputeStatus.prevented],
        ),
    ]
    resolved: Annotated[
        bool,
        Field(
            description="Whether the dispute has been resolved (won or lost).",
            examples=[False],
        ),
    ]
    closed: Annotated[
        bool,
        Field(
            description="Whether the dispute is closed (prevented, won, or lost).",
            examples=[False],
        ),
    ]
    amount: Annotated[
        int, Field(description="Amount in cents disputed.", examples=[1000])
    ]
    tax_amount: Annotated[
        int, Field(description="Tax amount in cents disputed.", examples=[200])
    ]
    currency: Annotated[
        str, Field(description="Currency code of the dispute.", examples=["usd"])
    ]
    reason: Annotated[
        str | None,
        Field(
            description=(
                "The reason for the dispute as reported by the card network "
                "(e.g. `fraudulent`, `product_not_received`). "
                "`None` until the processor reports it."
            ),
            examples=["fraudulent"],
        ),
    ]
    evidence_due_by: Annotated[
        datetime | None,
        Field(
            description=(
                "Deadline to submit evidence in response to the dispute. "
                "`None` when no response is required."
            ),
        ),
    ]
    past_due: Annotated[
        bool,
        Field(
            description="Whether the evidence submission deadline has passed.",
            examples=[False],
        ),
    ]
    order_id: Annotated[
        UUID4,
        Field(
            description="The ID of the order associated with the dispute.",
            examples=[ORDER_ID_EXAMPLE],
        ),
    ]
    payment_id: Annotated[
        UUID4,
        Field(
            description="The ID of the payment associated with the dispute.",
            examples=[PAYMENT_ID_EXAMPLE],
        ),
    ]


class Dispute(DisputeBase):
    """
    Schema representing a dispute.

    A dispute is a challenge raised by a customer or their bank regarding a payment.
    """

    customer: Annotated[
        DisputeCustomer,
        Field(description="The customer who was charged for the disputed payment."),
    ]
    case_id: Annotated[
        UUID4 | None,
        Field(
            description=(
                "The ID of the support case for this dispute, if one was opened."
            ),
        ),
    ]
