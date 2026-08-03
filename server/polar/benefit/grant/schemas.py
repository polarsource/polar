from pydantic import UUID4, Field, FutureDatetime

from polar.benefit.schemas import BenefitGrant
from polar.kit.schemas import Schema


class BenefitGrantCreate(Schema):
    customer_id: UUID4 = Field(
        description="The ID of the customer to grant the benefits to."
    )
    benefit_ids: list[UUID4] = Field(
        min_length=1,
        max_length=100,
        description="The IDs of the benefits to grant.",
    )
    expires_at: FutureDatetime | None = Field(
        default=None,
        description="When set, all created benefit grants are revoked at this time.",
    )
    reason: str | None = Field(
        default=None,
        max_length=500,
        description="An optional reason for granting the benefits.",
    )


class BenefitGrantsCreated(Schema):
    items: list[BenefitGrant] = Field(description="The created benefit grants.")
