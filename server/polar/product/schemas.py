from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, Field

from polar.benefit.schemas import BenefitPublic, BenefitSubscriber
from polar.kit.schemas import EmptyStrToNone, Schema, TimestampedSchema
from polar.models.product import SubscriptionTierType
from polar.models.product_price import ProductPriceRecurringInterval, ProductPriceType

PRODUCT_NAME_MIN_LENGTH = 3
PRODUCT_NAME_MAX_LENGTH = 24
PRODUCT_DESCRIPTION_MAX_LENGTH = 240

# Product

# Ref: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-amount
MAXIMUM_PRICE_AMOUNT = 99999999


class ProductPriceRecurringCreate(Schema):
    type: Literal[ProductPriceType.recurring]
    recurring_interval: ProductPriceRecurringInterval
    price_amount: int = Field(..., gt=0, le=MAXIMUM_PRICE_AMOUNT)
    price_currency: str = Field("usd", pattern="usd")


class ProductPriceOneTimeCreate(Schema):
    type: Literal[ProductPriceType.one_time]
    price_amount: int = Field(..., gt=0, le=MAXIMUM_PRICE_AMOUNT)
    price_currency: str = Field("usd", pattern="usd")


ProductPriceCreate = Annotated[
    ProductPriceRecurringCreate | ProductPriceOneTimeCreate, Discriminator("type")
]


class ProductCreate(Schema):
    type: Literal[
        SubscriptionTierType.individual,
        SubscriptionTierType.business,
    ]
    name: str = Field(
        ..., min_length=PRODUCT_NAME_MIN_LENGTH, max_length=PRODUCT_NAME_MAX_LENGTH
    )
    description: EmptyStrToNone = Field(
        default=None, max_length=PRODUCT_DESCRIPTION_MAX_LENGTH
    )
    is_highlighted: bool = False
    prices: list[ProductPriceCreate] = Field(..., min_length=1)
    organization_id: UUID4 | None = None


class ExistingProductPrice(Schema):
    id: UUID4


class ProductUpdate(Schema):
    name: str | None = Field(
        default=None,
        min_length=PRODUCT_NAME_MIN_LENGTH,
        max_length=PRODUCT_NAME_MAX_LENGTH,
    )
    description: EmptyStrToNone = Field(
        default=None, max_length=PRODUCT_DESCRIPTION_MAX_LENGTH
    )
    is_highlighted: bool | None = None
    prices: list[ExistingProductPrice | ProductPriceCreate] | None = Field(default=None)


class ProductBenefitsUpdate(Schema):
    benefits: list[UUID4]


class ProductPrice(TimestampedSchema):
    id: UUID4
    type: ProductPriceType
    recurring_interval: ProductPriceRecurringInterval | None = None
    price_amount: int
    price_currency: str
    is_archived: bool


class ProductBase(TimestampedSchema):
    id: UUID4
    type: SubscriptionTierType
    name: str
    description: str | None = None
    is_highlighted: bool
    is_archived: bool
    organization_id: UUID4
    prices: list[ProductPrice]


class Product(ProductBase):
    benefits: list[BenefitPublic] = Field(title="BenefitPublic")


class ProductSubscriber(ProductBase):
    benefits: list[BenefitSubscriber] = Field(title="BenefitSubscriber")
