from datetime import datetime
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.benefit.strategies.base.schemas import BenefitGrantBase
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema

ManualGrantID = Annotated[UUID4, Path(description="The manual grant ID.")]


class ManualGrantBenefitCreate(Schema):
    benefit_id: UUID4 = Field(description="The ID of the benefit to grant.")
    member_id: UUID4 | None = Field(
        default=None,
        description=(
            "The ID of the member to grant the benefit to. "
            "If not set, the customer's owner member is used when applicable."
        ),
    )


class ManualGrantCreate(Schema):
    customer_id: UUID4 = Field(
        description="The ID of the customer to grant the benefits to."
    )
    grants: list[ManualGrantBenefitCreate] = Field(
        min_length=1,
        description="The benefits to grant to the customer.",
    )
    expires_at: datetime | None = Field(
        default=None,
        description=(
            "When set, every grant in this manual grant is revoked at this time."
        ),
    )


class ManualGrantBenefit(BenefitGrantBase):
    """A single benefit grant materialized by a manual grant."""


class ManualGrant(IDSchema, TimestampedSchema):
    """A manual, standalone grant of benefits to a customer."""

    customer_id: UUID4 = Field(
        description="The ID of the customer the benefits are granted to."
    )
    expires_at: datetime | None = Field(
        default=None,
        description="When set, every grant is revoked at this time.",
    )
    grants: list[ManualGrantBenefit] = Field(
        description=(
            "The benefit grants materialized by this manual grant. "
            "Grants are materialized asynchronously, so this list is empty in the "
            "immediate response to creating a manual grant; fetch the manual grant "
            "again to observe the materialized grants."
        )
    )
