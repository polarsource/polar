from pydantic import UUID4, Field

from polar.kit.schemas import Schema


class StandaloneGrantBenefitCreate(Schema):
    benefit_id: UUID4 = Field(description="The ID of the benefit to grant.")
    member_id: UUID4 | None = Field(
        default=None,
        description=(
            "The ID of the member to grant the benefit to. "
            "If not set, the customer's owner member is used when applicable."
        ),
    )
