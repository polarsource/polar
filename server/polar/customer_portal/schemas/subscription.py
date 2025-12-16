import inspect
from typing import Annotated

from pydantic import UUID4, AliasChoices, AliasPath, Field
from pydantic.json_schema import SkipJsonSchema

from polar.enums import SubscriptionProrationBehavior
from polar.kit.schemas import IDSchema, Schema, SetSchemaReference, TimestampedSchema
from polar.meter.schemas import NAME_DESCRIPTION as METER_NAME_DESCRIPTION
from polar.models.subscription import CustomerCancellationReason
from polar.product.schemas import (
    BenefitPublicList,
    ProductBase,
    ProductMediaList,
    ProductPrice,
    ProductPriceList,
)
from polar.subscription.schemas import SubscriptionBase, SubscriptionMeterBase

from .organization import CustomerOrganization


class CustomerSubscriptionProduct(ProductBase):
    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList
    organization: CustomerOrganization


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


class CustomerSubscriptionUpdateProduct(Schema):
    product_id: UUID4 = Field(description="Update subscription to another product.")


class CustomerSubscriptionUpdateSeats(Schema):
    seats: int = Field(
        description="Update the number of seats for this subscription.",
        ge=1,
    )
    proration_behavior: SubscriptionProrationBehavior | None = Field(
        default=None,
        description=(
            "Determine how to handle the proration billing. "
            "If not provided, will use the default organization setting."
        ),
    )


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
    CustomerSubscriptionUpdateProduct
    | CustomerSubscriptionUpdateSeats
    | CustomerSubscriptionCancel,
    SetSchemaReference("CustomerSubscriptionUpdate"),
]
