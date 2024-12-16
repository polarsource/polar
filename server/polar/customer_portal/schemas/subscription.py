from datetime import datetime

from pydantic import UUID4, AliasChoices, AliasPath, Field

from polar.kit.schemas import Schema
from polar.models.subscription import SubscriptionStatus
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
    cancel_at_period_end: bool
    started_at: datetime | None
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


class CustomerSubscriptionUpdate(Schema):
    product_price_id: UUID4
