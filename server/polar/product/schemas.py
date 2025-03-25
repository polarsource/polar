import builtins
from typing import Annotated, Any, Literal

import stripe as stripe_lib
from pydantic import UUID4, Discriminator, Field, Tag, computed_field
from pydantic.aliases import AliasChoices

from polar.benefit.schemas import Benefit, BenefitID, BenefitPublic
from polar.custom_field.attachment import (
    AttachedCustomField,
    AttachedCustomFieldListCreate,
)
from polar.enums import SubscriptionRecurringInterval
from polar.file.schemas import ProductMediaFileRead
from polar.kit.db.models import Model
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
    OptionalMetadataInputMixin,
)
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
    ProductPriceType,
)
from polar.models.product_price import (
    ProductPriceCustom as ProductPriceCustomModel,
)
from polar.models.product_price import (
    ProductPriceFixed as ProductPriceFixedModel,
)
from polar.models.product_price import (
    ProductPriceFree as ProductPriceFreeModel,
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
    amount_type: ProductPriceAmountType

    def get_model_class(self) -> builtins.type[Model]:
        raise NotImplementedError()


class ProductPriceFixedCreate(ProductPriceCreateBase):
    """
    Schema to create a fixed price.
    """

    amount_type: Literal[ProductPriceAmountType.fixed]
    price_amount: PriceAmount
    price_currency: PriceCurrency

    def get_model_class(self) -> builtins.type[ProductPriceFixedModel]:
        return ProductPriceFixedModel

    def get_stripe_price_params(
        self, recurring_interval: SubscriptionRecurringInterval | None
    ) -> stripe_lib.Price.CreateParams:
        params: stripe_lib.Price.CreateParams = {
            "unit_amount": self.price_amount,
            "currency": self.price_currency,
        }
        if recurring_interval is not None:
            params = {
                **params,
                "recurring": {"interval": recurring_interval.as_literal()},
            }
        return params


class ProductPriceCustomCreate(ProductPriceCreateBase):
    """
    Schema to create a pay-what-you-want price.
    """

    amount_type: Literal[ProductPriceAmountType.custom]
    price_currency: PriceCurrency
    minimum_amount: PriceAmount | None = Field(
        default=None, ge=50, description="The minimum amount the customer can pay."
    )
    maximum_amount: PriceAmount | None = Field(
        default=None,
        le=1_000_000,  # $10K
        description="The maximum amount the customer can pay.",
    )
    preset_amount: PriceAmount | None = Field(
        default=None,
        le=1_000_000,  # $10K
        description="The initial amount shown to the customer.",
    )

    def get_model_class(self) -> builtins.type[ProductPriceCustomModel]:
        return ProductPriceCustomModel

    def get_stripe_price_params(
        self, recurring_interval: SubscriptionRecurringInterval | None
    ) -> stripe_lib.Price.CreateParams:
        custom_unit_amount_params: stripe_lib.Price.CreateParamsCustomUnitAmount = {
            "enabled": True,
        }
        if self.minimum_amount is not None:
            custom_unit_amount_params["minimum"] = self.minimum_amount
        if self.maximum_amount is not None:
            custom_unit_amount_params["maximum"] = self.maximum_amount
        if self.preset_amount is not None:
            custom_unit_amount_params["preset"] = self.preset_amount

        # `recurring_interval` is unused because we actually create ad-hoc prices,
        # since Stripe doesn't support PWYW pricing for subscriptions.

        return {
            "currency": self.price_currency,
            "custom_unit_amount": custom_unit_amount_params,
        }


class ProductPriceFreeCreate(ProductPriceCreateBase):
    """
    Schema to create a free price.
    """

    amount_type: Literal[ProductPriceAmountType.free]

    def get_model_class(self) -> builtins.type[ProductPriceFreeModel]:
        return ProductPriceFreeModel

    def get_stripe_price_params(
        self, recurring_interval: SubscriptionRecurringInterval | None
    ) -> stripe_lib.Price.CreateParams:
        params: stripe_lib.Price.CreateParams = {
            "unit_amount": 0,
            "currency": "usd",
        }
        if recurring_interval is not None:
            params = {
                **params,
                "recurring": {"interval": recurring_interval.as_literal()},
            }

        return params


ProductPriceCreate = (
    ProductPriceFixedCreate | ProductPriceCustomCreate | ProductPriceFreeCreate
)


ProductPriceCreateList = Annotated[
    list[ProductPriceCreate],
    Field(min_length=1, max_length=1),
    MergeJSONSchema(
        {
            "title": "ProductPriceCreateList",
            "description": "List with a single price.",
        }
    ),
]


class ProductCreate(MetadataInputMixin, Schema):
    """
    Schema to create a product.
    """

    name: ProductName
    description: ProductDescription = None
    recurring_interval: SubscriptionRecurringInterval | None = Field(
        description=(
            "The recurring interval of the product. "
            "If `None`, the product is a one-time purchase."
        ),
    )
    prices: ProductPriceCreateList = Field(
        ...,
        description="List of available prices for this product. "
        "Currently, only a single price is supported.",
    )
    medias: list[UUID4] | None = Field(
        default=None,
        description=(
            "List of file IDs. "
            "Each one must be on the same organization as the product, "
            "of type `product_media` and correctly uploaded."
        ),
    )
    attached_custom_fields: AttachedCustomFieldListCreate = Field(default_factory=list)
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the product. "
            "**Required unless you use an organization token.**"
        ),
    )


class ExistingProductPrice(Schema):
    """
    A price that already exists for this product.

    Useful when updating a product if you want to keep an existing price.
    """

    id: UUID4


ProductPriceUpdate = Annotated[
    ExistingProductPrice | ProductPriceCreate, Field(union_mode="left_to_right")
]


class ProductUpdate(OptionalMetadataInputMixin, Schema):
    """
    Schema to update a product.
    """

    name: ProductName | None = None
    description: ProductDescription = None
    recurring_interval: SubscriptionRecurringInterval | None = Field(
        default=None,
        description=(
            "The recurring interval of the product. "
            "If `None`, the product is a one-time purchase. "
            "**Can only be set on legacy recurring products. "
            "Once set, it can't be changed.**"
        ),
    )
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
    attached_custom_fields: AttachedCustomFieldListCreate | None = None


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
    is_archived: bool = Field(
        description="Whether the price is archived and no longer available."
    )
    product_id: UUID4 = Field(description="The ID of the product owning the price.")

    type: ProductPriceType = Field(
        validation_alias=AliasChoices("legacy_type", "type"),
        deprecated=(
            "This field is actually set from Product. "
            "It's only kept for backward compatibility."
        ),
    )
    recurring_interval: SubscriptionRecurringInterval | None = Field(
        validation_alias=AliasChoices(
            "legacy_recurring_interval", "recurring_interval"
        ),
        deprecated=(
            "This field is actually set from Product. "
            "It's only kept for backward compatibility."
        ),
    )


class ProductPriceFixedBase(ProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.fixed]
    price_currency: str = Field(description="The currency.")
    price_amount: int = Field(description="The price in cents.")


class ProductPriceCustomBase(ProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.custom]
    price_currency: str = Field(description="The currency.")
    minimum_amount: int | None = Field(
        description="The minimum amount the customer can pay."
    )
    maximum_amount: int | None = Field(
        description="The maximum amount the customer can pay."
    )
    preset_amount: int | None = Field(
        description="The initial amount shown to the customer."
    )


class ProductPriceFreeBase(ProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.free]


class LegacyRecurringProductPriceMixin:
    @computed_field
    def legacy(self) -> Literal[True]:
        return True


class LegacyRecurringProductPriceFixed(
    ProductPriceFixedBase, LegacyRecurringProductPriceMixin
):
    """
    A recurring price for a product, i.e. a subscription.

    **Deprecated**: The recurring interval should be set on the product itself.
    """

    type: Literal[ProductPriceType.recurring] = Field(
        description="The type of the price."
    )
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The recurring interval of the price."
    )


class LegacyRecurringProductPriceCustom(
    ProductPriceCustomBase, LegacyRecurringProductPriceMixin
):
    """
    A pay-what-you-want recurring price for a product, i.e. a subscription.

    **Deprecated**: The recurring interval should be set on the product itself.
    """

    type: Literal[ProductPriceType.recurring] = Field(
        description="The type of the price."
    )
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The recurring interval of the price."
    )


class LegacyRecurringProductPriceFree(
    ProductPriceFreeBase, LegacyRecurringProductPriceMixin
):
    """
    A free recurring price for a product, i.e. a subscription.

    **Deprecated**: The recurring interval should be set on the product itself.
    """

    type: Literal[ProductPriceType.recurring] = Field(
        description="The type of the price."
    )
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The recurring interval of the price."
    )


LegacyRecurringProductPrice = Annotated[
    LegacyRecurringProductPriceFixed
    | LegacyRecurringProductPriceCustom
    | LegacyRecurringProductPriceFree,
    Discriminator("amount_type"),
    SetSchemaReference("LegacyRecurringProductPrice"),
]


class ProductPriceFixed(ProductPriceFixedBase):
    """
    A fixed price for a product.
    """


class ProductPriceCustom(ProductPriceCustomBase):
    """
    A pay-what-you-want price for a product.
    """


class ProductPriceFree(ProductPriceFreeBase):
    """
    A free price for a product.
    """


class ProductPriceMeter(IDSchema):
    """
    A meter associated to a metered price.
    """

    name: str = Field(description="The name of the meter.")


class ProductPriceMeteredUnit(ProductPriceBase):
    """
    A metered, usage-based, price for a product, with a fixed unit price.
    """

    amount_type: Literal[ProductPriceAmountType.metered_unit]
    price_currency: str = Field(description="The currency.")
    unit_amount: int = Field(description="The price per unit in cents.")
    included_units: int = Field(
        description=(
            "The number of units included in the price. "
            "They will be deducted from the total."
        )
    )
    cap_amount: int | None = Field(
        description=(
            "The maximum amount in cents that can be charged, "
            "regardless of the number of units consumed."
        )
    )
    meter_id: UUID4 = Field(description="The ID of the meter associated to the price.")
    meter: ProductPriceMeter = Field(description="The meter associated to the price.")


NewProductPrice = Annotated[
    ProductPriceFixed | ProductPriceCustom | ProductPriceFree | ProductPriceMeteredUnit,
    Discriminator("amount_type"),
    SetSchemaReference("ProductPrice"),
]


def _get_discriminator_value(v: Any) -> Literal["legacy", "new"]:
    if isinstance(v, dict):
        return "legacy" if "legacy" in v else "new"
    type = getattr(v, "type", None)
    return "legacy" if type is not None else "new"


ProductPrice = Annotated[
    Annotated[LegacyRecurringProductPrice, Tag("legacy")]
    | Annotated[NewProductPrice, Tag("new")],
    Discriminator(_get_discriminator_value),
]


class ProductBase(IDSchema, TimestampedSchema):
    id: UUID4 = Field(description="The ID of the product.")
    name: str = Field(description="The name of the product.")
    description: str | None = Field(description="The description of the product.")
    recurring_interval: SubscriptionRecurringInterval | None = Field(
        description="The recurring interval of the product. "
        "If `None`, the product is a one-time purchase."
    )
    is_recurring: bool = Field(description="Whether the product is a subscription.")
    is_archived: bool = Field(
        description="Whether the product is archived and no longer available."
    )
    organization_id: UUID4 = Field(
        description="The ID of the organization owning the product."
    )


ProductPriceList = Annotated[
    list[ProductPrice],
    Field(
        description="List of prices for this product.",
    ),
]
BenefitList = Annotated[
    list[Benefit],
    Field(
        description="List of benefits granted by the product.",
    ),
]
ProductMediaList = Annotated[
    list[ProductMediaFileRead],
    Field(
        description="List of medias associated to the product.",
    ),
]


class Product(MetadataOutputMixin, ProductBase):
    """
    A product.
    """

    prices: ProductPriceList
    benefits: BenefitList
    medias: ProductMediaList
    attached_custom_fields: list[AttachedCustomField] = Field(
        description="List of custom fields attached to the product."
    )


BenefitPublicList = Annotated[
    list[BenefitPublic],
    Field(
        title="BenefitPublic",
        description="List of benefits granted by the product.",
    ),
]
