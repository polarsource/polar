from pydantic import UUID4, ConfigDict, Field

from polar.kit.external_id import ExternalID
from polar.kit.schemas import BENEFIT_ID_EXAMPLE, CUSTOMER_ID_EXAMPLE, Schema
from polar.organization.schemas import OrganizationID


class BenefitGrantCreate(Schema):
    """Manually grant a benefit using Polar IDs."""

    model_config = ConfigDict(extra="forbid")

    customer_id: UUID4 = Field(
        description="The ID of the customer.",
        examples=[CUSTOMER_ID_EXAMPLE],
    )
    benefit_id: UUID4 = Field(
        description="The ID of the benefit.",
        examples=[BENEFIT_ID_EXAMPLE],
    )
    member_id: UUID4 | None = Field(
        default=None,
        description=(
            "The ID of the member receiving the benefit. "
            "If not provided, the benefit is granted to the customer's owner."
        ),
    )


class BenefitGrantCreateExternal(Schema):
    """Manually grant a benefit using external IDs."""

    model_config = ConfigDict(extra="forbid")

    external_customer_id: str = Field(
        min_length=1,
        description="The ID of the customer in your system.",
        examples=["usr_1337"],
    )
    external_benefit_id: ExternalID = Field(
        description=(
            "The ID of the benefit in your system. "
            "Resolves to the current version of the benefit."
        ),
        examples=["ext_1337"],
    )
    external_member_id: str | None = Field(
        default=None,
        min_length=1,
        description=(
            "The ID of the member in your system, scoped to the customer. "
            "If not provided, the benefit is granted to the customer's owner."
        ),
    )
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the customer and benefit. "
            "**Required unless your credential identifies one organization.** "
            "Omit this field when using an organization token."
        ),
    )
