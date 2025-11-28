import builtins
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import UUID4, Discriminator, Field, Tag, computed_field, field_validator
from pydantic.aliases import AliasChoices
from pydantic.json_schema import SkipJsonSchema

from polar.benefit.schemas import Benefit, BenefitID, BenefitPublic
from polar.custom_field.schemas import (
    AttachedCustomField,
    AttachedCustomFieldListCreate,
)
from polar.enums import SubscriptionRecurringInterval
from polar.file.schemas import ProductMediaFileRead
from polar.kit.db.models import Model
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
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
from polar.kit.trial import TrialConfigurationInputMixin, TrialConfigurationOutputMixin
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceSource,
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
from polar.models.product_price import (
    ProductPriceMeteredUnit as ProductPriceMeteredUnitModel,
)
from polar.models.product_price import (
    ProductPriceSeatUnit as ProductPriceSeatUnitModel,
)
from polar.organization.schemas import OrganizationID

PRODUCT_NAME_MIN_LENGTH = 3

# PostgreSQL int4 range limit
INT_MAX_VALUE = 2_147_483_647

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
SeatPriceAmount = Annotated[
    int,
    Field(
        ...,
        ge=0,
        le=MAXIMUM_PRICE_AMOUNT,
        description="The price per seat in cents. Can be 0 for free tiers.",
    ),
]
PriceCurrency = Annotated[
    str,
    Field(
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
    price_currency: PriceCurrency = "usd"

    def get_model_class(self) -> builtins.type[ProductPriceFixedModel]:
        return ProductPriceFixedModel


class ProductPriceCustomCreate(ProductPriceCreateBase):
    """
    Schema to create a pay-what-you-want price.
    """

    amount_type: Literal[ProductPriceAmountType.custom]
    price_currency: PriceCurrency = "usd"
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


class ProductPriceFreeCreate(ProductPriceCreateBase):
    """
    Schema to create a free price.
    """

    amount_type: Literal[ProductPriceAmountType.free]

    def get_model_class(self) -> builtins.type[ProductPriceFreeModel]:
        return ProductPriceFreeModel


class ProductPriceSeatTier(Schema):
    """
    A pricing tier for seat-based pricing.
    """

    min_seats: int = Field(ge=1, description="Minimum number of seats (inclusive)")
    max_seats: int | None = Field(
        default=None,
        ge=1,
        description="Maximum number of seats (inclusive). None for unlimited.",
    )
    price_per_seat: SeatPriceAmount = Field(
        description="Price per seat in cents for this tier"
    )


class ProductPriceSeatTiers(Schema):
    """
    List of pricing tiers for seat-based pricing.
    """

    tiers: list[ProductPriceSeatTier] = Field(
        min_length=1, description="List of pricing tiers"
    )

    @field_validator("tiers")
    @classmethod
    def validate_tiers(
        cls, v: list[ProductPriceSeatTier]
    ) -> list[ProductPriceSeatTier]:
        """Validate that tiers form continuous ranges without gaps or overlaps."""
        if not v:
            raise ValueError("At least one tier is required")

        # Sort by min_seats
        sorted_tiers = sorted(v, key=lambda t: t.min_seats)

        # Ensure first tier starts at 1
        if sorted_tiers[0].min_seats != 1:
            raise ValueError("First tier must start at min_seats=1")

        # Validate continuous ranges without gaps/overlaps
        for i in range(len(sorted_tiers) - 1):
            current = sorted_tiers[i]
            next_tier = sorted_tiers[i + 1]

            if current.max_seats is None:
                raise ValueError(
                    "Only the last tier can have unlimited max_seats (None)"
                )

            if next_tier.min_seats != current.max_seats + 1:
                raise ValueError(
                    "Gap or overlap between tiers: "
                    + f"tier ending at {current.max_seats} and tier starting at {next_tier.min_seats}"
                )

        # Ensure last tier has unlimited max_seats
        last_tier = sorted_tiers[-1]
        if last_tier.max_seats is not None:
            raise ValueError(
                "Last tier must have unlimited max_seats (None). "
                + f"Currently set to {last_tier.max_seats}."
            )

        return sorted_tiers


class ProductPriceSeatBasedCreate(ProductPriceCreateBase):
    """
    Schema to create a seat-based price with volume-based tiers.
    """

    amount_type: Literal[ProductPriceAmountType.seat_based]
    price_currency: PriceCurrency = "usd"
    seat_tiers: ProductPriceSeatTiers = Field(
        description="Tiered pricing based on seat quantity"
    )

    def get_model_class(self) -> builtins.type[ProductPriceSeatUnitModel]:
        return ProductPriceSeatUnitModel


class ProductPriceMeteredCreateBase(ProductPriceCreateBase):
    meter_id: UUID4 = Field(description="The ID of the meter associated to the price.")


class ProductPriceMeteredUnitCreate(ProductPriceMeteredCreateBase):
    """
    Schema to create a metered price with a fixed unit price.
    """

    amount_type: Literal[ProductPriceAmountType.metered_unit]
    price_currency: PriceCurrency = "usd"
    unit_amount: Decimal = Field(
        gt=0,
        max_digits=17,
        decimal_places=12,
        description="The price per unit in cents. Supports up to 12 decimal places.",
    )
    cap_amount: int | None = Field(
        default=None,
        ge=0,
        le=INT_MAX_VALUE,
        description=(
            "Optional maximum amount in cents that can be charged, "
            "regardless of the number of units consumed."
        ),
    )

    def get_model_class(self) -> builtins.type[ProductPriceMeteredUnitModel]:
        return ProductPriceMeteredUnitModel


ProductPriceCreate = Annotated[
    ProductPriceFixedCreate
    | ProductPriceCustomCreate
    | ProductPriceFreeCreate
    | ProductPriceSeatBasedCreate
    | ProductPriceMeteredUnitCreate,
    Discriminator("amount_type"),
]


ProductPriceCreateList = Annotated[
    list[ProductPriceCreate],
    Field(min_length=1),
    MergeJSONSchema(
        {
            "title": "ProductPriceCreateList",
            "description": (
                "List of prices for the product. "
                "At most one static price (fixed, custom or free) is allowed. "
                "Any number of metered prices can be added."
            ),
        }
    ),
]


class ProductCreateBase(MetadataInputMixin, Schema):
    name: ProductName
    description: ProductDescription = None
    prices: ProductPriceCreateList = Field(
        ...,
        description="List of available prices for this product. "
        "It should contain at most one static price (fixed, custom or free), and "
        "any number of metered prices. "
        "Metered prices are not supported on one-time purchase products.",
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


class ProductCreateRecurring(TrialConfigurationInputMixin, ProductCreateBase):
    recurring_interval: SubscriptionRecurringInterval = Field(
        description=(
            "The recurring interval of the product. "
            "Note that the `day` and `week` values are for internal Polar staff use only."
        ),
    )
    recurring_interval_count: int = Field(
        default=1,
        ge=1,
        le=999,
        description=(
            "Number of interval units of the subscription. "
            "If this is set to 1 the charge will happen every interval (e.g. every month), "
            "if set to 2 it will be every other month, and so on."
        ),
    )


class ProductCreateOneTime(ProductCreateBase):
    recurring_interval: Literal[None] = Field(
        default=None, description="States that the product is a one-time purchase."
    )
    recurring_interval_count: Literal[None] = Field(
        default=None,
        description="One-time products don't have a recurring interval count.",
    )


ProductCreate = Annotated[
    ProductCreateRecurring | ProductCreateOneTime,
    SetSchemaReference("ProductCreate"),
]


class ExistingProductPrice(Schema):
    """
    A price that already exists for this product.

    Useful when updating a product if you want to keep an existing price.
    """

    id: UUID4


ProductPriceUpdate = Annotated[
    ExistingProductPrice | ProductPriceCreate, Field(union_mode="left_to_right")
]


class ProductUpdate(TrialConfigurationInputMixin, MetadataInputMixin, Schema):
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
    recurring_interval_count: int | None = Field(
        default=None,
        ge=1,
        le=999,
        description=(
            "Number of interval units of the subscription. "
            "If this is set to 1 the charge will happen every interval (e.g. every month), "
            "if set to 2 it will be every other month, and so on. "
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
    source: ProductPriceSource = Field(
        description=(
            "The source of the price . "
            "`catalog` is a predefined price, "
            "while `ad_hoc` is a price created dynamically on a Checkout session."
        )
    )
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


class ProductPriceSeatBasedBase(ProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.seat_based]
    price_currency: str = Field(description="The currency.")
    seat_tiers: ProductPriceSeatTiers = Field(
        description="Tiered pricing based on seat quantity"
    )

    @computed_field(
        description="Price per seat in cents from the first tier.",
        deprecated=(
            "Use `seat_tiers` instead. "
            "The tiered pricing system supports volume-based pricing with multiple tiers. "
            "This field returns only the first tier's price for backward compatibility."
        ),
    )
    def price_per_seat(self) -> SkipJsonSchema[int]:
        """Return price_per_seat from first tier for backward compatibility."""
        if not self.seat_tiers.tiers:
            # This shouldn't happen due to validation, but protect against it
            raise ValueError("seat_tiers must contain at least one tier")
        return self.seat_tiers.tiers[0].price_per_seat


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


class ProductPriceSeatBased(ProductPriceSeatBasedBase):
    """
    A seat-based price for a product.
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
    unit_amount: Decimal = Field(description="The price per unit in cents.")
    cap_amount: int | None = Field(
        description=(
            "The maximum amount in cents that can be charged, "
            "regardless of the number of units consumed."
        )
    )
    meter_id: UUID4 = Field(description="The ID of the meter associated to the price.")
    meter: ProductPriceMeter = Field(description="The meter associated to the price.")


NewProductPrice = Annotated[
    ProductPriceFixed
    | ProductPriceCustom
    | ProductPriceFree
    | ProductPriceSeatBased
    | ProductPriceMeteredUnit,
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


class ProductBase(TrialConfigurationOutputMixin, TimestampedSchema, IDSchema):
    name: str = Field(description="The name of the product.")
    description: str | None = Field(description="The description of the product.")
    recurring_interval: SubscriptionRecurringInterval | None = Field(
        description=(
            "The recurring interval of the product. "
            "If `None`, the product is a one-time purchase."
        )
    )
    recurring_interval_count: int | None = Field(
        description=(
            "Number of interval units of the subscription. "
            "If this is set to 1 the charge will happen every interval (e.g. every month), "
            "if set to 2 it will be every other month, and so on. "
            "None for one-time products."
        )
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
