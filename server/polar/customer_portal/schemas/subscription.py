import inspect
from datetime import datetime
from typing import Annotated

from pydantic import UUID4, AliasChoices, AliasPath, Field

from polar.kit.schemas import (
    Schema,
    SetSchemaReference,
)
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.organization.schemas import Organization
from polar.product.schemas import (
    BenefitPublicList,
    ProductBase,
    ProductMediaList,
    ProductPrice,
    ProductPriceList,
)
from polar.subscription.schemas import SubscriptionBase


class CustomerSubscriptionBase(SubscriptionBase):
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime | None
    canceled_at: datetime | None
    cancel_at_period_end: bool
    started_at: datetime | None
    ends_at: datetime | None
    ended_at: datetime | None

    customer_id: UUID4
    product_id: UUID4
    price_id: UUID4


class CustomerSubscriptionProduct(ProductBase):
    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList
    organization: Organization


class CustomerSubscription(CustomerSubscriptionBase):
    user_id: UUID4 = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user_id",
            # Validate from ORM model
            AliasPath("customer", "legacy_user_id"),
        ),
        deprecated="Use `customer_id`.",
    )
    product: CustomerSubscriptionProduct
    price: ProductPrice


class CustomerSubscriptionUpdatePrice(Schema):
    product_price_id: UUID4 = Field(description="Update subscription to another price.")


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
    CustomerSubscriptionUpdatePrice | CustomerSubscriptionCancel,
    SetSchemaReference("CustomerSubscriptionUpdate"),
]
