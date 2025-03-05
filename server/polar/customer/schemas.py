import hashlib
from datetime import datetime
from typing import Annotated, Literal

from fastapi import Path
from pydantic import UUID4, Field, computed_field
from pydantic.aliases import AliasPath

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.enums import SubscriptionRecurringInterval
from polar.kit.address import Address
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
    OptionalMetadataInputMixin,
)
from polar.kit.schemas import (
    BENEFIT_GRANT_ID_EXAMPLE,
    BENEFIT_ID_EXAMPLE,
    CUSTOMER_ID_EXAMPLE,
    ORGANIZATION_ID_EXAMPLE,
    PRICE_ID_EXAMPLE,
    PRODUCT_ID_EXAMPLE,
    SUBSCRIPTION_ID_EXAMPLE,
    EmailStrDNS,
    IDSchema,
    Schema,
    TimestampedSchema,
)
from polar.kit.tax import TaxID
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrantProperties
from polar.models.subscription import SubscriptionStatus
from polar.organization.schemas import OrganizationID

CustomerID = Annotated[UUID4, Path(description="The customer ID.")]
CustomerExternalID = Annotated[str, Path(description="The customer external ID.")]

_external_id_description = (
    "The ID of the customer in your system. "
    "This must be unique within the organization. "
    "Once set, it can't be updated."
)
_external_id_example = "usr_1337"
_email_description = (
    "The email address of the customer. This must be unique within the organization."
)
_email_example = "customer@example.com"
_name_description = "The name of the customer."
_name_example = "John Doe"


class CustomerCreate(MetadataInputMixin, Schema):
    external_id: str | None = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
    )
    email: EmailStrDNS = Field(
        description=_email_description, examples=[_email_example]
    )
    name: str | None = Field(
        default=None, description=_name_description, examples=[_name_example]
    )
    billing_address: Address | None = None
    tax_id: TaxID | None = None
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the customer. "
            "**Required unless you use an organization token.**"
        ),
    )


class CustomerUpdate(OptionalMetadataInputMixin, Schema):
    external_id: str | None = Field(
        default=None,
        description=_external_id_description,
        examples=[_external_id_example],
    )
    email: EmailStrDNS | None = Field(
        default=None, description=_email_description, examples=[_email_example]
    )
    name: str | None = Field(
        default=None, description=_name_description, examples=[_name_example]
    )
    billing_address: Address | None = None
    tax_id: TaxID | None = None


class CustomerBase(MetadataOutputMixin, TimestampedSchema, IDSchema):
    id: UUID4 = Field(
        description="The ID of the customer.", examples=[CUSTOMER_ID_EXAMPLE]
    )
    external_id: str | None = Field(
        description=_external_id_description, examples=[_external_id_example]
    )
    email: str = Field(description=_email_description, examples=[_email_example])
    email_verified: bool = Field(
        description=(
            "Whether the customer email address is verified. "
            "The address is automatically verified when the customer accesses "
            "the customer portal using their email address."
        ),
        examples=[True],
    )
    name: str | None = Field(description=_name_description, examples=[_name_example])
    billing_address: Address | None
    tax_id: TaxID | None
    organization_id: UUID4 = Field(
        description="The ID of the organization owning the customer.",
        examples=[ORGANIZATION_ID_EXAMPLE],
    )

    @computed_field(examples=["https://www.gravatar.com/avatar/xxx?d=blank"])
    def avatar_url(self) -> str:
        email_hash = hashlib.sha256(self.email.lower().encode()).hexdigest()
        return f"https://www.gravatar.com/avatar/{email_hash}?d=blank"


class Customer(CustomerBase):
    """A customer in an organization."""


class CustomerStateSubscription(
    MetadataOutputMixin, CustomFieldDataOutputMixin, TimestampedSchema, IDSchema
):
    """An active customer subscription."""

    id: UUID4 = Field(
        description="The ID of the subscription.", examples=[SUBSCRIPTION_ID_EXAMPLE]
    )
    status: Literal[SubscriptionStatus.active] = Field(examples=["active"])
    amount: int | None = Field(
        description="The amount of the subscription.", examples=[1000]
    )
    currency: str | None = Field(
        description="The currency of the subscription.", examples=["usd"]
    )
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The interval at which the subscription recurs."
    )
    current_period_start: datetime = Field(
        description="The start timestamp of the current billing period.",
        examples=["2025-02-03T13:37:00Z"],
    )
    current_period_end: datetime | None = Field(
        description="The end timestamp of the current billing period.",
        examples=["2025-03-03T13:37:00Z"],
    )
    cancel_at_period_end: bool = Field(
        description=(
            "Whether the subscription will be canceled "
            "at the end of the current period."
        ),
        examples=[False],
    )
    canceled_at: datetime | None = Field(
        description=(
            "The timestamp when the subscription was canceled. "
            "The subscription might still be active if `cancel_at_period_end` is `true`."
        ),
        examples=[None],
    )
    started_at: datetime | None = Field(
        description="The timestamp when the subscription started.",
        examples=["2025-01-03T13:37:00Z"],
    )
    ends_at: datetime | None = Field(
        description="The timestamp when the subscription will end.",
        examples=[None],
    )

    product_id: UUID4 = Field(
        description="The ID of the subscribed product.", examples=[PRODUCT_ID_EXAMPLE]
    )
    price_id: UUID4 = Field(
        description="The ID of the subscribed price.", examples=[PRICE_ID_EXAMPLE]
    )
    discount_id: UUID4 | None = Field(
        description="The ID of the applied discount, if any.", examples=[None]
    )


class CustomerStateBenefitGrant(TimestampedSchema, IDSchema):
    """An active benefit grant for a customer."""

    id: UUID4 = Field(
        description="The ID of the grant.", examples=[BENEFIT_GRANT_ID_EXAMPLE]
    )
    granted_at: datetime = Field(
        description="The timestamp when the benefit was granted.",
        examples=["2025-01-03T13:37:00Z"],
    )
    benefit_id: UUID4 = Field(
        description="The ID of the benefit concerned by this grant.",
        examples=[BENEFIT_ID_EXAMPLE],
    )
    benefit_type: BenefitType = Field(
        description="The type of the benefit concerned by this grant.",
        validation_alias=AliasPath("benefit", "type"),
        examples=[BenefitType.custom],
    )
    properties: BenefitGrantProperties


class CustomerState(CustomerBase):
    """
    A customer along with additional state information:

    * Active subscriptions
    * Active benefits
    """

    active_subscriptions: list[CustomerStateSubscription] = Field(
        description="The customer's active subscriptions."
    )
    granted_benefits: list[CustomerStateBenefitGrant] = Field(
        description="The customer's active benefit grants."
    )
