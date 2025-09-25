import inspect
from typing import Annotated

from pydantic import UUID4, AliasChoices, AliasPath, Field, computed_field
from pydantic.json_schema import SkipJsonSchema

from polar.kit.schemas import IDSchema, Schema, SetSchemaReference, TimestampedSchema
from polar.meter.schemas import NAME_DESCRIPTION as METER_NAME_DESCRIPTION
from polar.models.subscription import CustomerCancellationReason
from polar.organization.schemas import Organization
from polar.product.schemas import (
    BenefitPublicList,
    ProductBase,
    ProductMediaList,
    ProductPrice,
    ProductPriceList,
)
from polar.subscription.schemas import SubscriptionBase, SubscriptionMeterBase


class CustomerSubscriptionProduct(ProductBase):
    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList
    organization: Organization


class CustomerSubscriptionMeterMeter(IDSchema, TimestampedSchema):
    name: str = Field(description=METER_NAME_DESCRIPTION)


class CustomerSubscriptionMeter(SubscriptionMeterBase):
    meter: CustomerSubscriptionMeterMeter


class CustomerSubscription(SubscriptionBase):
    user_id: SkipJsonSchema[UUID4] = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user_id",
            # Validate from ORM model
            AliasPath("customer", "legacy_user_id"),
        ),
        deprecated="Use `customer_id`.",
    )
    product: CustomerSubscriptionProduct

    price: SkipJsonSchema[ProductPrice] = Field(
        deprecated="Use `prices` instead.",
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "price",
            # Validate from ORM model
            AliasPath("prices", 0),
        ),
    )

    prices: list[ProductPrice] = Field(
        description="List of enabled prices for the subscription."
    )
    meters: list[CustomerSubscriptionMeter] = Field(
        description="List of meters associated with the subscription."
    )

    stripe_subscription_id: SkipJsonSchema[str | None] = Field(
        validation_alias="stripe_subscription_id"
    )

    @computed_field
    def is_polar_managed(self) -> bool:
        """Whether the subscription is managed by Polar."""
        return self.stripe_subscription_id is None


class CustomerSubscriptionUpdateProduct(Schema):
    product_id: UUID4 = Field(description="Update subscription to another product.")


class CustomerSubscriptionCancel(Schema):
    cancel_at_period_end: bool | None = Field(
        None,
        description=inspect.cleandoc(
            """
        Cancel an active subscription once the current period ends.

        Or uncancel a subscription currently set to be revoked at period end.
        """
        ),
    )

    cancellation_reason: CustomerCancellationReason | None = Field(
        None,
        description=inspect.cleandoc(
            """
        Customers reason for cancellation.

        * `too_expensive`: Too expensive for the customer.
        * `missing_features`: Customer is missing certain features.
        * `switched_service`: Customer switched to another service.
        * `unused`: Customer is not using it enough.
        * `customer_service`: Customer is not satisfied with the customer service.
        * `low_quality`: Customer is unhappy with the quality.
        * `too_complex`: Customer considers the service too complicated.
        * `other`: Other reason(s).
        """
        ),
    )
    cancellation_comment: str | None = Field(
        None, description="Customer feedback and why they decided to cancel."
    )


CustomerSubscriptionUpdate = Annotated[
    CustomerSubscriptionUpdateProduct | CustomerSubscriptionCancel,
    SetSchemaReference("CustomerSubscriptionUpdate"),
]
