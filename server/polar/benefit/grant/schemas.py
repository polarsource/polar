from pydantic import UUID4, Field, FutureDatetime

from polar.kit.schemas import Schema


class BenefitGrantCreate(Schema):
    customer_id: UUID4 = Field(
        description="The ID of the customer to grant the benefit to."
    )
    benefit_id: UUID4 = Field(description="The ID of the benefit to grant.")
    member_id: UUID4 | None = Field(
        default=None,
        description=(
            "The ID of the member to grant the benefit to. "
            "If not set, the customer's owner member is used when applicable."
        ),
    )
    expires_at: FutureDatetime | None = Field(
        default=None,
        description="When set, the benefit grant is revoked at this time.",
    )
    reason: str | None = Field(
        default=None,
        max_length=500,
        description="An optional reason for granting the benefit.",
    )


class BenefitGrantBatchItemCreate(Schema):
    benefit_id: UUID4 = Field(description="The ID of the benefit to grant.")
    member_id: UUID4 | None = Field(
        default=None,
        description=(
            "The ID of the member to grant the benefit to. "
            "If not set, the customer's owner member is used when applicable."
        ),
    )


class BenefitGrantBatchCreate(Schema):
    customer_id: UUID4 = Field(
        description="The ID of the customer to grant the benefits to."
    )
    grants: list[BenefitGrantBatchItemCreate] = Field(
        min_length=1,
        max_length=100,
        description="The benefits to grant as one batch.",
    )
    expires_at: FutureDatetime | None = Field(
        default=None,
        description="When set, all grants in the batch are revoked at this time.",
    )
    reason: str | None = Field(
        default=None,
        max_length=500,
        description="An optional reason for granting the benefits.",
    )
