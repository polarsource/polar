from datetime import datetime

from pydantic import UUID4, Field, computed_field, field_validator
from pydantic.json_schema import SkipJsonSchema

from polar.kit.metadata import MetadataInputMixin, MetadataOutputMixin
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.kit.visibility import Visibility
from polar.models.benefit import BenefitType, BenefitVisibility
from polar.models.benefit_grant import BenefitGrantError
from polar.organization.schemas import OrganizationID, OrganizationPublicBase

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
    visibility: BenefitVisibility | None = Field(
        None,
        description="The visibility of the benefit in the customer portal.",
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
    visibility: BenefitVisibility | None = Field(
        None,
        description="The visibility of the benefit in the customer portal.",
    )


class BenefitPublicBase(TimestampedSchema, IDSchema):
    id: UUID4 = Field(..., description="The ID of the benefit.")
    type: BenefitType = Field(..., description="The type of the benefit.")
    description: str = Field(..., description="The description of the benefit.")
    selectable: bool = Field(
        ..., description="Whether the benefit is selectable when creating a product."
    )
    deletable: bool = Field(..., description="Whether the benefit is deletable.")
    is_deleted: bool = Field(..., description="Whether the benefit is deleted.")
    organization_id: UUID4 = Field(
        ..., description="The ID of the organization owning the benefit."
    )


class BenefitBase(MetadataOutputMixin, BenefitPublicBase):
    visibility: BenefitVisibility = Field(
        description="The visibility of the benefit in the customer portal."
    )

    @field_validator("visibility", mode="before")
    @classmethod
    def default_null_visibility(cls, value: Visibility | None) -> Visibility:
        if value is None:
            return Visibility.public
        return value

    @computed_field  # type: ignore[prop-decorator]
    @property
    def visibility_configurable(self) -> bool:
        return self.type.is_visibility_configurable()


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
    member_id: UUID4 | None = Field(
        default=None,
        description="The ID of the member concerned by this grant.",
    )
    benefit_id: UUID4 = Field(
        description="The ID of the benefit concerned by this grant."
    )
    error: BenefitGrantError | None = Field(
        None,
        description="The error information if the benefit grant failed with an unrecoverable error.",
    )

    @computed_field(deprecated="Use `customer_id`.")
    def user_id(self) -> SkipJsonSchema[UUID4]:
        return self.customer_id


class BenefitSubscriberOrganization(OrganizationPublicBase): ...


class BenefitSubscriberBase(BenefitBase):
    organization: BenefitSubscriberOrganization
