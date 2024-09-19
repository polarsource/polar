import builtins
from typing import Annotated, Literal

import stripe as stripe_lib
from pydantic import UUID4, AfterValidator, Discriminator, Field

from polar.benefit.schemas import BenefitID, BenefitPublic
from polar.enums import SubscriptionRecurringInterval
from polar.file.schemas import ProductMediaFileRead
from polar.kit.db.models import Model
from polar.kit.schemas import (
    EmptyStrToNoneValidator,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SelectorWidget,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceType,
)
from polar.organization.schemas import OrganizationID

PRODUCT_NAME_MIN_LENGTH = 3

# Product

ProductID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The product ID."}),
    SelectorWidget("/v1/products", "Product", "name"),
]

# Ref: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-amount
MAXIMUM_PRICE_AMOUNT = 99999999
MINIMUM_PRICE_AMOUNT = 50


PriceAmount = Annotated[
    int,
    Field(
        ...,
        ge=MINIMUM_PRICE_AMOUNT,
        le=MAXIMUM_PRICE_AMOUNT,
        description="The price in cents.",
    ),
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
        description="The name of the product.",
    ),
]
ProductDescription = Annotated[
    str | None,
    Field(description="The description of the product."),
    EmptyStrToNoneValidator,
]


class ProductPriceCreateBase(Schema):
    type: ProductPriceType
    price_currency: PriceCurrency

    def get_model_class(self) -> builtins.type[Model]:
        raise NotImplementedError()


class ProductPriceFixedCreateBase(ProductPriceCreateBase):
    price_amount: PriceAmount

    def get_model_class(self) -> builtins.type[ProductPriceFixed]:
        return ProductPriceFixed

    def get_stripe_price_params(self) -> stripe_lib.Price.CreateParams:
        return {
            "unit_amount": self.price_amount,
            "currency": self.price_currency,
        }


class ProductPriceCustomCreateBase(ProductPriceCreateBase):
    minimum_amount: PriceAmount | None = Field(
        default=None, description="The minimum amount the customer can pay."
    )
    maximum_amount: PriceAmount | None = Field(
        default=None, description="The maximum amount the customer can pay."
    )
    preset_amount: PriceAmount | None = Field(
        default=None,
        description="The initial amount shown to the customer.",
    )

    def get_model_class(self) -> builtins.type[ProductPriceCustom]:
        return ProductPriceCustom

    def get_stripe_price_params(self) -> stripe_lib.Price.CreateParams:
        custom_unit_amount_params: stripe_lib.Price.CreateParamsCustomUnitAmount = {
            "enabled": True,
        }
        if self.minimum_amount is not None:
            custom_unit_amount_params["minimum"] = self.minimum_amount
        if self.maximum_amount is not None:
            custom_unit_amount_params["maximum"] = self.maximum_amount
        if self.preset_amount is not None:
            custom_unit_amount_params["preset"] = self.preset_amount
        return {
            "currency": self.price_currency,
            "custom_unit_amount": custom_unit_amount_params,
        }


class ProductPriceRecurringCreate(ProductPriceFixedCreateBase):
    """
    Schema to create a recurring product price, i.e. a subscription.
    """

    type: Literal[ProductPriceType.recurring]
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The recurring interval of the price."
    )

    def get_stripe_price_params(self) -> stripe_lib.Price.CreateParams:
        return {
            **super().get_stripe_price_params(),
            "recurring": {"interval": self.recurring_interval.as_literal()},
        }


class ProductPriceOneTimeFixedCreate(ProductPriceFixedCreateBase):
    """
    Schema to create a one-time product price.
    """

    type: Literal[ProductPriceType.one_time]


class ProductPriceOneTimeCustomCreate(ProductPriceCustomCreateBase):
    """
    Schema to create a pay-what-you-want price for a one-time product.
    """

    type: Literal[ProductPriceType.one_time]


ProductPriceOneTimeCreate = (
    ProductPriceOneTimeFixedCreate | ProductPriceOneTimeCustomCreate
)


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
    organization_id: OrganizationID | None = Field(
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

    benefits: list[BenefitID] = Field(
        description=(
            "List of benefit IDs. "
            "Each one must be on the same organization as the product."
        )
    )


class ProductPriceBase(TimestampedSchema):
    id: UUID4 = Field(description="The ID of the price.")
    amount_type: ProductPriceAmountType = Field(
        description="The type of amount, either fixed or custom."
    )
    price_currency: str = Field(description="The currency.")
    is_archived: bool = Field(
        description="Whether the price is archived and no longer available."
    )


class ProductPriceFixedBase(ProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.fixed]
    price_amount: int = Field(description="The price in cents.")


class ProductPriceCustomBase(ProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.custom]
    minimum_amount: int | None = Field(
        description="The minimum amount the customer can pay."
    )
    maximum_amount: int | None = Field(
        description="The maximum amount the customer can pay."
    )
    preset_amount: int | None = Field(
        description="The initial amount shown to the customer."
    )


class ProductPriceRecurringFixed(ProductPriceFixedBase):
    """
    A recurring price for a product, i.e. a subscription.
    """

    type: Literal[ProductPriceType.recurring] = Field(
        description="The type of the price."
    )
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The recurring interval of the price."
    )


class ProductPriceRecurringCustom(ProductPriceCustomBase):
    """
    A pay-what-you-want recurring price for a product, i.e. a subscription.
    """

    type: Literal[ProductPriceType.recurring] = Field(
        description="The type of the price."
    )
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The recurring interval of the price."
    )


class ProductPriceOneTimeFixed(ProductPriceFixedBase):
    """
    A one-time price for a product.
    """

    type: Literal[ProductPriceType.one_time] = Field(
        description="The type of the price."
    )


ProductPriceRecurring = Annotated[
    ProductPriceRecurringFixed | ProductPriceRecurringCustom,
    Discriminator("amount_type"),
    SetSchemaReference("ProductPriceRecurring"),
]


class ProductPriceOneTimeCustom(ProductPriceCustomBase):
    """
    A pay-what-you-want price for a one-time product.
    """

    type: Literal[ProductPriceType.one_time] = Field(
        description="The type of the price."
    )


ProductPriceOneTime = Annotated[
    ProductPriceOneTimeFixed | ProductPriceOneTimeCustom,
    Discriminator("amount_type"),
    SetSchemaReference("ProductPriceOneTime"),
]


ProductPrice = Annotated[
    ProductPriceRecurring | ProductPriceOneTime,
    Discriminator("type"),
    SetSchemaReference("ProductPrice"),
]


class ProductBase(IDSchema, TimestampedSchema):
    id: UUID4 = Field(description="The ID of the product.")
    name: str = Field(description="The name of the product.")
    description: str | None = Field(description="The description of the product.")
    is_recurring: bool = Field(
        description="Whether the product is a subscription tier."
    )
    is_archived: bool = Field(
        description="Whether the product is archived and no longer available."
    )
    organization_id: UUID4 = Field(
        description="The ID of the organization owning the product."
    )


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
