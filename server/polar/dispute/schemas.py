from typing import Annotated

from pydantic import Field

from polar.kit.schemas import IDSchema, TimestampedSchema
from polar.models.dispute import DisputeStatus


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


class Dispute(DisputeBase):
    """
    Schema representing a dispute.

    A dispute is a challenge raised by a customer or their bank regarding a payment.
    """

    pass
