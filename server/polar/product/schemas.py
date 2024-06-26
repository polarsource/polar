from typing import Annotated, Literal

from pydantic import UUID4, AfterValidator, Discriminator, Field

from polar.benefit.schemas import BenefitPublic
from polar.file.schemas import ProductMediaFileRead
from polar.kit.schemas import (
    EmptyStrToNoneValidator,
    MergeJSONSchema,
    Schema,
    TimestampedSchema,
)
from polar.models.product import SubscriptionTierType
from polar.models.product_price import ProductPriceRecurringInterval, ProductPriceType

PRODUCT_NAME_MIN_LENGTH = 3
PRODUCT_NAME_MAX_LENGTH = 24

# Product

# Ref: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-amount
MAXIMUM_PRICE_AMOUNT = 99999999


PriceAmount = Annotated[
    int, Field(..., gt=0, le=MAXIMUM_PRICE_AMOUNT, description="The price in cents.")
]
PriceCurrency = Annotated[
    str,
    Field(
        default="usd",
        pattern="usd",
        description="The currency. Currently, only `usd` is supported.",
    ),
]
ProductName = Annotated[
    str,
    Field(
        min_length=PRODUCT_NAME_MIN_LENGTH,
        max_length=PRODUCT_NAME_MAX_LENGTH,
        description="The name of the product.",
    ),
]
ProductDescription = Annotated[
    str | None,
    Field(
        default=None,
        description="The description of the product.",
    ),
    EmptyStrToNoneValidator,
]


class ProductPriceRecurringCreate(Schema):
    """
    Schema to create a recurring product price, i.e. a subscription.
    """

    type: Literal[ProductPriceType.recurring]
    recurring_interval: ProductPriceRecurringInterval = Field(
        description="The recurring interval of the price."
    )
    price_amount: PriceAmount
    price_currency: PriceCurrency


class ProductPriceOneTimeCreate(Schema):
    """
    Schema to create a one-time product price.
    """

    type: Literal[ProductPriceType.one_time]
    price_amount: PriceAmount
    price_currency: PriceCurrency


def _check_intervals(
    value: list[ProductPriceRecurringCreate],
) -> list[ProductPriceRecurringCreate]:
    intervals = {price.recurring_interval for price in value}
    if len(intervals) != len(value):
        raise ValueError("Only one price per interval is allowed.")
    return value


ProductPriceRecurringCreateList = Annotated[
    list[ProductPriceRecurringCreate],
    Field(min_length=1, max_length=2),
    AfterValidator(_check_intervals),
    MergeJSONSchema(
        {
            "title": "Recurring prices",
            "description": (
                "List of recurring prices. "
                "Only one price per interval (one monthly and one yearly) is allowed."
            ),
        }
    ),
]

ProductPriceOneTimeCreateList = Annotated[
    list[ProductPriceOneTimeCreate],
    Field(min_length=1, max_length=1),
    MergeJSONSchema(
        {
            "title": "One-time price",
            "description": "List with a single one-time price.",
        }
    ),
]


class ProductCreateBase(Schema):
    name: ProductName
    description: ProductDescription = None

    prices: ProductPriceRecurringCreateList | ProductPriceOneTimeCreateList = Field(
        ..., description="List of available prices for this product."
    )
    medias: list[UUID4] | None = Field(
        default=None,
        description=(
            "List of file IDs. "
            "Each one must be on the same organization as the product, "
            "of type `product_media` and correctly uploaded."
        ),
    )
    organization_id: UUID4 | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the product. "
            "**Required unless you use an organization token.**"
        ),
    )


class ProductRecurringCreate(ProductCreateBase):
    """
    Schema to create a recurring product, i.e. a subscription.
    """

    prices: ProductPriceRecurringCreateList = Field(
        ..., description="List of available prices for this product."
    )
    type: Literal[
        SubscriptionTierType.individual,
        SubscriptionTierType.business,
    ] = Field(deprecated=True)
    is_highlighted: bool = Field(default=False, deprecated=True)


class ProductOneTimeCreate(ProductCreateBase):
    """
    Schema to create a one-time product.
    """

    prices: ProductPriceOneTimeCreateList = Field(
        ..., description="List of available prices for this product."
    )


ProductCreate = Annotated[
    ProductRecurringCreate | ProductOneTimeCreate,
    MergeJSONSchema({"title": "ProductCreate"}),
]


class ExistingProductPrice(Schema):
    """
    A price that already exists for this product.

    Useful when updating a product if you want to keep an existing price.
    """

    id: UUID4


ProductPriceUpdate = Annotated[
    ExistingProductPrice | ProductPriceRecurringCreate | ProductPriceOneTimeCreate,
    Field(union_mode="left_to_right"),
]


class ProductUpdate(Schema):
    """
    Schema to update a product.
    """

    name: ProductName | None = None
    description: ProductDescription = None
    is_highlighted: bool | None = Field(default=None, deprecated=True)
    is_archived: bool | None = Field(
        default=None,
        description=(
            "Whether the product is archived. "
            "If `true`, the product won't be available for purchase anymore. "
            "Existing customers will still have access to their benefits, "
            "and subscriptions will continue normally."
        ),
    )
    prices: list[ProductPriceUpdate] | None = Field(
        default=None,
        description=(
            "List of available prices for this product. "
            "If you want to keep existing prices, include them in the list "
            "as an `ExistingProductPrice` object."
        ),
    )
    medias: list[UUID4] | None = Field(
        default=None,
        description=(
            "List of file IDs. "
            "Each one must be on the same organization as the product, "
            "of type `product_media` and correctly uploaded."
        ),
    )


class ProductBenefitsUpdate(Schema):
    """
    Schema to update the benefits granted by a product.
    """

    benefits: list[UUID4] = Field(
        description=(
            "List of benefit IDs. "
            "Each one must be on the same organization as the product."
        )
    )


class ProductPriceBase(TimestampedSchema):
    id: UUID4 = Field(description="The ID of the price.")
    price_amount: int = Field(description="The price in cents.")
    price_currency: str = Field(description="The currency.")
    is_archived: bool = Field(
        description="Whether the price is archived and no longer available."
    )


class ProductPriceRecurring(ProductPriceBase):
    """
    A recurring price for a product, i.e. a subscription.
    """

    type: Literal[ProductPriceType.recurring] = Field(
        description="The type of the price."
    )
    recurring_interval: ProductPriceRecurringInterval | None = Field(
        None, description="The recurring interval of the price, if type is `recurring`."
    )


class ProductPriceOneTime(ProductPriceBase):
    """
    A one-time price for a product.
    """

    type: Literal[ProductPriceType.one_time] = Field(
        description="The type of the price."
    )


ProductPrice = Annotated[
    ProductPriceRecurring | ProductPriceOneTime, Discriminator("type")
]


class ProductBase(TimestampedSchema):
    id: UUID4 = Field(description="The ID of the product.")
    name: str = Field(description="The name of the product.")
    description: str | None = Field(
        default=None, description="The description of the product."
    )
    is_recurring: bool = Field(
        description="Whether the product is a subscription tier."
    )
    is_archived: bool = Field(
        description="Whether the product is archived and no longer available."
    )
    organization_id: UUID4 = Field(
        description="The ID of the organization owning the product."
    )

    type: SubscriptionTierType | None = Field(default=None, deprecated=True)
    is_highlighted: bool | None = Field(default=None, deprecated=True)


class Product(ProductBase):
    """
    A product.
    """

    prices: list[ProductPrice] = Field(
        description="List of available prices for this product."
    )
    benefits: list[BenefitPublic] = Field(
        title="BenefitPublic", description="The benefits granted by the product."
    )
    medias: list[ProductMediaFileRead] = Field(
        description="The medias associated to the product."
    )
