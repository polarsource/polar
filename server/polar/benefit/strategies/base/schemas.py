from datetime import datetime

from pydantic import (
    UUID4,
    Field,
)

from polar.kit.metadata import MetadataInputMixin, MetadataOutputMixin
from polar.kit.schemas import (
    IDSchema,
    Schema,
    TimestampedSchema,
)
from polar.models.benefit import BenefitType
from polar.organization.schemas import Organization, OrganizationID

BENEFIT_DESCRIPTION_MIN_LENGTH = 3
BENEFIT_DESCRIPTION_MAX_LENGTH = 42


class BenefitProperties(Schema): ...


class BenefitCreateBase(MetadataInputMixin, Schema):
    type: BenefitType
    description: str = Field(
        ...,
        min_length=BENEFIT_DESCRIPTION_MIN_LENGTH,
        max_length=BENEFIT_DESCRIPTION_MAX_LENGTH,
        description=(
            "The description of the benefit. "
            "Will be displayed on products having this benefit."
        ),
    )
    organization_id: OrganizationID | None = Field(
        None,
        description=(
            "The ID of the organization owning the benefit. "
            "**Required unless you use an organization token.**"
        ),
    )


class BenefitUpdateBase(MetadataInputMixin, Schema):
    description: str | None = Field(
        None,
        min_length=BENEFIT_DESCRIPTION_MIN_LENGTH,
        max_length=BENEFIT_DESCRIPTION_MAX_LENGTH,
        description=(
            "The description of the benefit. "
            "Will be displayed on products having this benefit."
        ),
    )


class BenefitBase(MetadataOutputMixin, TimestampedSchema, IDSchema):
    id: UUID4 = Field(..., description="The ID of the benefit.")
    type: BenefitType = Field(..., description="The type of the benefit.")
    description: str = Field(..., description="The description of the benefit.")
    selectable: bool = Field(
        ..., description="Whether the benefit is selectable when creating a product."
    )
    deletable: bool = Field(..., description="Whether the benefit is deletable.")
    organization_id: UUID4 = Field(
        ..., description="The ID of the organization owning the benefit."
    )


class BenefitGrantBase(IDSchema, TimestampedSchema):
    """
    A grant of a benefit to a customer.
    """

    id: UUID4 = Field(description="The ID of the grant.")
    granted_at: datetime | None = Field(
        None,
        description=(
            "The timestamp when the benefit was granted. "
            "If `None`, the benefit is not granted."
        ),
    )
    is_granted: bool = Field(description="Whether the benefit is granted.")
    revoked_at: datetime | None = Field(
        None,
        description=(
            "The timestamp when the benefit was revoked. "
            "If `None`, the benefit is not revoked."
        ),
    )
    is_revoked: bool = Field(description="Whether the benefit is revoked.")
    subscription_id: UUID4 | None = Field(
        description="The ID of the subscription that granted this benefit.",
    )
    order_id: UUID4 | None = Field(
        description="The ID of the order that granted this benefit."
    )
    customer_id: UUID4 = Field(
        description="The ID of the customer concerned by this grant."
    )
    user_id: UUID4 = Field(
        validation_alias="customer_id", deprecated="Use `customer_id`."
    )
    benefit_id: UUID4 = Field(
        description="The ID of the benefit concerned by this grant."
    )


class BenefitSubscriberBase(BenefitBase):
    organization: Organization
