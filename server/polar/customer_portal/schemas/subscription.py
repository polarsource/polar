import inspect
from typing import Annotated, Literal

from pydantic import (
    UUID4,
    AliasChoices,
    AliasPath,
    ConfigDict,
    Field,
    FutureDatetime,
)
from pydantic.json_schema import SkipJsonSchema

from polar.kit.schemas import (
    IDSchema,
    Int32,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.meter.schemas import NAME_DESCRIPTION as METER_NAME_DESCRIPTION
from polar.models.subscription import CustomerCancellationReason
from polar.product.schemas import (
    BenefitPublicList,
    ProductBase,
    ProductMediaList,
    ProductPrice,
    ProductPriceList,
)
from polar.subscription.schemas import (
    PendingSubscriptionUpdate,
    SubscriptionBase,
    SubscriptionMeterBase,
)

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
    pending_update: PendingSubscriptionUpdate | None = Field(
        description=(
            "Pending subscription update that will be applied at the beginning of the next period. "
            "If `null`, there is no pending update."
        )
    )


class CustomerSubscriptionUpdateProduct(Schema):
    product_id: UUID4 = Field(description="Update subscription to another product.")


class CustomerSubscriptionUpdateSeats(Schema):
    seats: Int32 = Field(
        description="Update the number of seats for this subscription.",
        ge=1,
    )


class CustomerSubscriptionChangePreviewProduct(Schema):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID4 = Field(
        description="Preview a change of the subscription to this product."
    )


class CustomerSubscriptionChangePreviewSeats(Schema):
    model_config = ConfigDict(extra="forbid")

    seats: Int32 = Field(
        description="Preview a change of the subscription to this number of seats.",
        ge=1,
    )


CustomerSubscriptionChangePreview = Annotated[
    CustomerSubscriptionChangePreviewProduct | CustomerSubscriptionChangePreviewSeats,
    SetSchemaReference("CustomerSubscriptionChangePreview"),
]


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


class CustomerSubscriptionPause(Schema):
    pause_at_period_end: bool = Field(
        description=inspect.cleandoc(
            """
        Pause an active subscription at the end of the current period.

        Or cancel a scheduled pause on a subscription set to be paused at
        period end.
        """
        ),
    )
    resumes_at: FutureDatetime | None = Field(
        None,
        description=(
            "Date at which the paused subscription should automatically resume. "
            "If not set, it stays paused until resumed. Must be after the current "
            "period end."
        ),
    )


class CustomerSubscriptionResume(Schema):
    resume: Literal[True] = Field(
        description=(
            "Resume a paused subscription immediately, "
            "starting a new billing period and charging the customer."
        )
    )


class CustomerSubscriptionUpdateClear(Schema):
    pending_update: None = Field(description="Clear the pending subscription update.")


CustomerSubscriptionUpdate = Annotated[
    CustomerSubscriptionUpdateProduct
    | CustomerSubscriptionUpdateSeats
    | CustomerSubscriptionCancel
    | CustomerSubscriptionPause
    | CustomerSubscriptionResume
    | CustomerSubscriptionUpdateClear,
    SetSchemaReference("CustomerSubscriptionUpdate"),
]
