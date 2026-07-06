import builtins
from collections.abc import Sequence
from decimal import Decimal
from typing import Annotated, Any, Literal, Self

from pydantic import (
    UUID4,
    BeforeValidator,
    Discriminator,
    Field,
    Tag,
    ValidationInfo,
    computed_field,
    field_validator,
    model_validator,
)
from pydantic.aliases import AliasChoices
from pydantic.json_schema import SkipJsonSchema
from pydantic_core import PydanticCustomError

from polar.benefit.schemas import Benefit, BenefitID, BenefitPublic
from polar.custom_field.schemas import (
    AttachedCustomField,
    AttachedCustomFieldListCreate,
)
from polar.enums import (
    MeterInterval,
    SubscriptionRecurringInterval,
    TaxBehaviorOption,
)
from polar.file.schemas import ProductMediaFileRead
from polar.kit.currency import (
    MAXIMUM_PRICE_PER_CURRENCY_DOCSTRING,
    MINIMUM_PRICE_PER_CURRENCY_DOCSTRING,
    PresentmentCurrency,
    format_currency,
    get_maximum_currency_amount,
    get_minimum_currency_amount,
)
from polar.kit.db.models import Model
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import (
    EmptyStrToNoneValidator,
    IDSchema,
    Int32,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    StripValidator,
    TimestampedSchema,
)
from polar.kit.trial import TrialConfigurationInputMixin, TrialConfigurationOutputMixin
from polar.kit.visibility import Visibility
from polar.meter.unit import MeterUnit
from polar.models import Benefit as BenefitModel
from polar.models.product import ProductVisibility
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceSource,
    ProductPriceType,
    SeatTierType,
)
from polar.models.product_price import (
    ProductPriceCustom as ProductPriceCustomModel,
)
from polar.models.product_price import (
    ProductPriceFixed as ProductPriceFixedModel,
)
from polar.models.product_price import (
    ProductPriceMeteredUnit as ProductPriceMeteredUnitModel,
)
from polar.models.product_price import (
    ProductPriceSeatUnit as ProductPriceSeatUnitModel,
)
from polar.organization.schemas import OrganizationID
from polar.product.meter_interval import meter_interval_divides_billing_interval

PRODUCT_NAME_MIN_LENGTH = 3
PRODUCT_NAME_MAX_LENGTH = 64

# Product

ProductID = Annotated[
    UUID4,
    MergeJSONSchema({"description": "The product ID."}),
]


def validate_price_amount(
    currency: str, amount: int, *, allow_zero: bool = False
) -> int:
    minimum = get_minimum_currency_amount(currency)
    if amount < minimum and not (allow_zero and amount == 0):
        if allow_zero:
            message = f"Amount must be at least {format_currency(minimum, currency)} or 0 for free pricing"
        else:
            message = f"Amount must be at least {format_currency(minimum, currency)}"
        raise PydanticCustomError("minimum_price", message)  # pyright: ignore
    maximum = get_maximum_currency_amount(currency)
    if amount > maximum:
        message = f"Amount must be at most {format_currency(maximum, currency)}"
        raise PydanticCustomError("maximum_price", message)  # pyright: ignore
    return amount


PriceAmount = Annotated[
    int,
    Field(
        ...,
        ge=1,
        description=f"The price in cents.\nMinimum amounts per currency:\n{MINIMUM_PRICE_PER_CURRENCY_DOCSTRING}",
    ),
]
SeatPriceAmount = Annotated[
    int,
    Field(
        ...,
        ge=0,
        description="The price per seat in cents. Can be 0 for free tiers.",
    ),
]
PriceCurrency = Annotated[
    PresentmentCurrency,
    Field(description="The currency in which the customer will be charged."),
]
ProductName = Annotated[
    str,
    StripValidator,
    Field(
        min_length=PRODUCT_NAME_MIN_LENGTH,
        max_length=PRODUCT_NAME_MAX_LENGTH,
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
    price_currency: PriceCurrency = PresentmentCurrency.usd
    tax_behavior: TaxBehaviorOption | None = Field(
        default=None,
        description=(
            "The tax behavior of the price. "
            "If not set, it will default to the organization's default tax behavior."
        ),
    )

    def get_model_class(self) -> builtins.type[Model]:
        raise NotImplementedError()


class ProductPriceFixedCreate(ProductPriceCreateBase):
    """
    Schema to create a fixed price.
    """

    amount_type: Literal[ProductPriceAmountType.fixed]
    price_amount: Annotated[
        PriceAmount,
        Field(
            ge=0,
            description=(
                "The price in cents. Set to `0` for a free price.\n"
                f"Minimum amounts per currency:\n{MINIMUM_PRICE_PER_CURRENCY_DOCSTRING}"
            ),
        ),
    ]

    @field_validator("price_amount")
    @classmethod
    def validate_price_amount(cls, v: int, info: ValidationInfo) -> int:
        currency = info.data.get("price_currency")
        if currency is None:
            # price_currency failed its own validation; skip currency-specific check
            # (Pydantic will already report the currency error)
            return v
        return validate_price_amount(currency, v, allow_zero=True)

    def get_model_class(self) -> builtins.type[ProductPriceFixedModel]:
        return ProductPriceFixedModel


class ProductPriceCustomCreate(ProductPriceCreateBase):
    """
    Schema to create a pay-what-you-want price.
    """

    amount_type: Literal[ProductPriceAmountType.custom]
    minimum_amount: int = Field(
        default=50,
        ge=0,
        description=(
            "The minimum amount the customer can pay. "
            "If set to 0, the price is 'free or pay what you want' and $0 is accepted. "
            "If set to a value below the minimum price amount for the currency, it will be rejected. "
            "Defaults to the minimum price amount for the currency. "
            f"Minimum per currency:\n{MINIMUM_PRICE_PER_CURRENCY_DOCSTRING}"
        ),
    )
    maximum_amount: PriceAmount | None = Field(
        default=None,
        description=(
            "The maximum amount the customer can pay. "
            f"Maximum per currency:\n{MAXIMUM_PRICE_PER_CURRENCY_DOCSTRING}"
        ),
    )
    preset_amount: PriceAmount | None = Field(
        default=None,
        ge=0,
        description=(
            "The initial amount shown to the customer. "
            "If 0, the customer will see $0 as the default. "
            "If set to a value below the minimum price amount for the currency, it will be rejected."
            f"Minimum per currency:\n{MINIMUM_PRICE_PER_CURRENCY_DOCSTRING}"
        ),
    )

    @field_validator("minimum_amount", "preset_amount", "maximum_amount")
    @classmethod
    def validate_amount_not_in_minimum_gap(
        cls, v: int | None, info: ValidationInfo
    ) -> int | None:
        if v is None:
            return v
        currency = info.data.get("price_currency")
        if currency is None:
            # price_currency failed its own validation; skip currency-specific check
            # (Pydantic will already report the currency error)
            return v
        return validate_price_amount(currency, v, allow_zero=True)

    def get_model_class(self) -> builtins.type[ProductPriceCustomModel]:
        return ProductPriceCustomModel


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

    The minimum and maximum seat limits are derived from the tiers:
    - minimum_seats = first tier's min_seats
    - maximum_seats = last tier's max_seats (None for unlimited)
    """

    seat_tier_type: SeatTierType = Field(
        default=SeatTierType.volume,
        description="How tiers are applied. 'volume' prices all seats at the matching tier's rate. 'graduated' prices each tier's range independently.",
    )
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

        # First tier must start at >= 1
        if sorted_tiers[0].min_seats < 1:
            raise ValueError("First tier must start at min_seats >= 1")

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

        return sorted_tiers

    @computed_field(
        description="Minimum number of seats required for purchase, derived from first tier."
    )
    def minimum_seats(self) -> int:
        """Get minimum seats from the first tier.

        Note: tiers are guaranteed to be sorted by the validator.
        """
        if not self.tiers:
            return 1
        return self.tiers[0].min_seats

    @computed_field(
        description="Maximum number of seats allowed for purchase, derived from last tier. None for unlimited."
    )
    def maximum_seats(self) -> int | None:
        """Get maximum seats from the last tier.

        Note: tiers are guaranteed to be sorted by the validator.
        """
        if not self.tiers:
            return None
        return self.tiers[-1].max_seats


class ProductPriceSeatBasedCreate(ProductPriceCreateBase):
    """
    Schema to create a seat-based price with volume-based tiers.
    """

    amount_type: Literal[ProductPriceAmountType.seat_based]
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
    unit_amount: Decimal = Field(
        gt=0,
        max_digits=17,
        decimal_places=12,
        description="The price per unit in cents. Supports up to 12 decimal places.",
    )
    cap_amount: Int32 | None = Field(
        default=None,
        ge=0,
        description=(
            "Optional maximum amount in cents that can be charged, "
            "regardless of the number of units consumed."
        ),
    )

    def get_model_class(self) -> builtins.type[ProductPriceMeteredUnitModel]:
        return ProductPriceMeteredUnitModel


def _coerce_legacy_free_price(value: Any) -> Any:
    """
    Backward compatibility for the removed `free` price type.

    `free` prices are no longer a distinct type: a free price is now a `fixed` price
    with an amount of `0`. Some integrations still send `amount_type: "free"` on
    input, so we keep accepting it and rewrite it to a `fixed` price of `0`. This is
    deliberately not exposed in the OpenAPI schema (no `free` member in the union),
    so it's dropped from future SDK versions.
    """
    if isinstance(value, dict) and value.get("amount_type") == "free":
        return {
            "amount_type": ProductPriceAmountType.fixed.value,
            "price_amount": 0,
            **{
                key: value[key]
                for key in ("price_currency", "tax_behavior")
                if key in value
            },
        }
    return value


ProductPriceCreate = Annotated[
    Annotated[
        ProductPriceFixedCreate
        | ProductPriceCustomCreate
        | ProductPriceSeatBasedCreate
        | ProductPriceMeteredUnitCreate,
        Discriminator("amount_type"),
    ],
    BeforeValidator(_coerce_legacy_free_price),
]


ProductPriceCreateList = Annotated[
    list[ProductPriceCreate],
    Field(min_length=1),
    MergeJSONSchema(
        {
            "title": "ProductPriceCreateList",
            "description": (
                "List of prices for the product. "
                "At most one fixed price and one seat-based price may be combined "
                "(billed as `fixed + seat_charge`), or a single custom "
                "price may stand alone, plus any number of metered prices. "
                "A custom price cannot be combined with a fixed or seat-based price."
            ),
        }
    ),
]


class ProductCreateBase(MetadataInputMixin, Schema):
    name: ProductName
    description: ProductDescription = None
    visibility: ProductVisibility = Field(
        default=Visibility.public,
        description="The visibility of the product.",
    )
    prices: ProductPriceCreateList = Field(
        ...,
        description="List of available prices for this product. "
        "It may combine at most one fixed price with one seat-based price "
        "(billed as `fixed + seat_charge`), or contain a single custom or free "
        "price, plus any number of metered prices. A free price cannot be "
        "combined with other prices, and a custom price cannot be combined with "
        "a fixed or seat-based price. "
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
        description="The recurring interval of the product.",
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
    meter_interval: MeterInterval | None = Field(
        default=None,
        description=(
            "Optional meter cycle, independent of the billing interval. "
            "When set, overage settlement, meter resets and meter-credit grants run "
            "on this cadence rather than the billing interval — e.g. yearly billing "
            "with monthly credits. It must evenly divide the billing interval. "
            "If `None`, metered concerns follow the billing interval. "
            "**Once set, it can't be changed.**"
        ),
    )
    meter_interval_count: int | None = Field(
        default=None,
        ge=1,
        le=999,
        description=(
            "Number of meter interval units. Defaults to 1 when `meter_interval` is "
            "set. Ignored when `meter_interval` is `None`."
        ),
    )

    @model_validator(mode="after")
    def validate_meter_interval(self) -> Self:
        if self.meter_interval is None:
            self.meter_interval_count = None
            return self
        if self.meter_interval_count is None:
            self.meter_interval_count = 1
        if not meter_interval_divides_billing_interval(
            self.meter_interval,
            self.meter_interval_count,
            self.recurring_interval,
            self.recurring_interval_count,
        ):
            raise ValueError(
                "The meter interval must evenly divide the billing interval, "
                "so the meter cycle re-aligns with the billing cycle at every renewal."
            )
        return self


class ProductCreateOneTime(ProductCreateBase):
    recurring_interval: Literal[None] = Field(
        default=None, description="States that the product is a one-time purchase."
    )
    recurring_interval_count: Literal[None] = Field(
        default=None,
        description="One-time products don't have a recurring interval count.",
    )


def _product_create_discriminator(v: Any) -> str:
    if isinstance(v, dict):
        ri = v.get("recurring_interval")
    else:
        ri = getattr(v, "recurring_interval", None)
    return "recurring" if ri is not None else "one_time"


ProductCreate = Annotated[
    Annotated[ProductCreateRecurring, Tag("recurring")]
    | Annotated[ProductCreateOneTime, Tag("one_time")],
    Discriminator(_product_create_discriminator),
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
    visibility: ProductVisibility | None = Field(
        default=None,
        description="The visibility of the product.",
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
    price_currency: str = Field(
        description="The currency in which the customer will be charged."
    )
    tax_behavior: TaxBehaviorOption | None = Field(
        description=(
            "The tax behavior of the price. "
            "If null, it defaults to the organization's default tax behavior."
        )
    )
    is_archived: bool = Field(
        description="Whether the price is archived and no longer available."
    )
    product_id: UUID4 = Field(description="The ID of the product owning the price.")

    type: SkipJsonSchema[ProductPriceType] = Field(
        validation_alias=AliasChoices("legacy_type", "type"),
        deprecated=(
            "This field is actually set from Product. "
            "It's only kept for backward compatibility."
        ),
    )
    recurring_interval: SkipJsonSchema[SubscriptionRecurringInterval | None] = Field(
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
    price_amount: int = Field(description="The price in cents.")


class ProductPriceCustomBase(ProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.custom]
    minimum_amount: int = Field(
        description=(
            "The minimum amount the customer can pay. "
            "If 0, the price is 'free or pay what you want'."
        )
    )
    maximum_amount: int | None = Field(
        description="The maximum amount the customer can pay."
    )
    preset_amount: int | None = Field(
        description="The initial amount shown to the customer."
    )


class ProductPriceSeatBasedBase(ProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.seat_based]
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


LegacyRecurringProductPrice = Annotated[
    LegacyRecurringProductPriceFixed | LegacyRecurringProductPriceCustom,
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


class ProductPriceSeatBased(ProductPriceSeatBasedBase):
    """
    A seat-based price for a product.
    """


class ProductPriceMeter(IDSchema):
    """
    A meter associated to a metered price.
    """

    name: str = Field(description="The name of the meter.")
    unit: MeterUnit = Field(description="The unit of the meter.")
    custom_label: str | None = Field(description="The label for the custom unit.")
    custom_multiplier: int | None = Field(
        description="The multiplier to convert from base unit to display scale."
    )


class ProductPriceMeteredUnit(ProductPriceBase):
    """
    A metered, usage-based, price for a product, with a fixed unit price.
    """

    amount_type: Literal[ProductPriceAmountType.metered_unit]
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
    visibility: ProductVisibility = Field(description="The visibility of the product.")
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
    meter_interval: MeterInterval | None = Field(
        description=(
            "The meter cycle of the product, independent of the billing interval. "
            "If `None`, metered concerns follow the billing interval."
        ),
    )
    meter_interval_count: int | None = Field(
        description="Number of meter interval units. None when no meter cycle is set.",
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


BenefitPublicListInput = BenefitModel | BenefitPublic


# Filter out hidden benefits before they're serialized to BenefitPublic, which
# doesn't expose visibility. Already-serialized items have no visibility to check.
def _filter_benefit_public_list(
    benefits: Sequence[BenefitPublicListInput],
) -> list[BenefitPublicListInput]:
    return [
        benefit
        for benefit in benefits
        if not isinstance(benefit, BenefitModel)
        or benefit.visibility == Visibility.public
    ]


BenefitPublicList = Annotated[
    list[BenefitPublic],
    BeforeValidator(_filter_benefit_public_list),
    Field(
        title="BenefitPublic",
        description="List of benefits granted by the product.",
    ),
]
