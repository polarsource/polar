from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any, Literal, Self

from annotated_types import Gt
from pydantic import UUID4, ConfigDict, Discriminator, Field, model_validator

from polar.benefit.strategies.base.schemas import (
    BENEFIT_DESCRIPTION_MAX_LENGTH,
    BENEFIT_DESCRIPTION_MIN_LENGTH,
)
from polar.benefit.strategies.custom.schemas import BenefitCustomCreateProperties
from polar.benefit.strategies.custom.schemas import (
    BenefitCustomProperties as BenefitCustomOutputProperties,
)
from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeysCreateProperties,
    BenefitLicenseKeysProperties,
)
from polar.enums import MeterInterval, SubscriptionRecurringInterval, TaxBehaviorOption
from polar.kit.metadata import MetadataInputMixin, MetadataOutputMixin
from polar.kit.schemas import Int32, Schema, SetSchemaReference
from polar.kit.trial import TrialConfigurationInputMixin, TrialInterval
from polar.kit.visibility import Visibility
from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter
from polar.meter.schemas import NAME_DESCRIPTION, MeterCreateBase
from polar.meter.unit import MeterUnit
from polar.models.benefit import BenefitType, BenefitVisibility
from polar.models.product import ProductVisibility
from polar.models.product_price import ProductPriceAmountType
from polar.organization.schemas import OrganizationID
from polar.product.meter_interval import meter_interval_divides_billing_interval
from polar.product.schemas import (
    PriceAmount,
    ProductDescription,
    ProductName,
    ProductPriceCreateBase,
    ProductPriceCustomCreate,
    ProductPriceFixedCreate,
    ProductPriceSeatBasedCreate,
    ProductPriceUnitBasedCreate,
    UnitLabel,
)
from polar.product.tiers import Tiers, TiersInput

MAXIMUM_METERS = 100
MAXIMUM_BENEFITS = 100
MAXIMUM_PRODUCTS = 100


class ConfigMeter(MeterCreateBase):
    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(
        ...,
        min_length=1,
        description=(
            "Your identifier for the meter. "
            "Used to match the config entry with an existing meter."
        ),
    )


MeterReference = Annotated[
    str,
    Field(
        min_length=1,
        description="The `external_id` of a meter declared in the same config.",
    ),
]

BenefitReference = Annotated[
    str,
    Field(
        min_length=1,
        description="The `external_id` of a benefit declared in the same config.",
    ),
]


class ConfigBenefitBase(MetadataInputMixin, Schema):
    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(
        ...,
        min_length=1,
        description="Your identifier for the benefit, used to match it.",
    )
    description: str = Field(
        ...,
        min_length=BENEFIT_DESCRIPTION_MIN_LENGTH,
        max_length=BENEFIT_DESCRIPTION_MAX_LENGTH,
        description=(
            "The description of the benefit. "
            "Will be displayed on products having this benefit."
        ),
    )
    visibility: BenefitVisibility = Field(
        default=Visibility.public, description="The visibility of the benefit."
    )


class ConfigBenefitFeatureFlag(ConfigBenefitBase):
    type: Literal[BenefitType.feature_flag]


class ConfigBenefitCustomProperties(BenefitCustomCreateProperties):
    model_config = ConfigDict(extra="forbid")


class ConfigBenefitCustom(ConfigBenefitBase):
    type: Literal[BenefitType.custom]
    properties: ConfigBenefitCustomProperties = Field(
        default_factory=ConfigBenefitCustomProperties
    )


class ConfigBenefitLicenseKeysProperties(BenefitLicenseKeysCreateProperties):
    model_config = ConfigDict(extra="forbid")


class ConfigBenefitLicenseKeys(ConfigBenefitBase):
    type: Literal[BenefitType.license_keys]
    properties: ConfigBenefitLicenseKeysProperties = Field(
        default_factory=ConfigBenefitLicenseKeysProperties
    )


class ConfigBenefitMeterCreditProperties(Schema):
    model_config = ConfigDict(extra="forbid")

    meter: MeterReference
    units: Annotated[Int32, Gt(0)] = Field(
        description="Number of units credited on the meter each cycle."
    )
    rollover: bool = Field(
        default=False,
        description="Whether unused units carry over to the next cycle.",
    )


class ConfigBenefitMeterCredit(ConfigBenefitBase):
    type: Literal[BenefitType.meter_credit]
    properties: ConfigBenefitMeterCreditProperties


ConfigBenefit = Annotated[
    ConfigBenefitCustom
    | ConfigBenefitFeatureFlag
    | ConfigBenefitLicenseKeys
    | ConfigBenefitMeterCredit,
    Discriminator("type"),
    SetSchemaReference("ConfigBenefit"),
]


class ConfigProductPriceFixed(ProductPriceFixedCreate):
    model_config = ConfigDict(extra="forbid")

    price_amount: Annotated[
        PriceAmount,
        Field(
            ge=0,
            description=(
                "The price in cents. Set to `0` for a free price. "
                "Must be at least the currency's minimum amount."
            ),
        ),
    ]


class ConfigProductPriceMeteredUnit(ProductPriceCreateBase):
    model_config = ConfigDict(extra="forbid")

    amount_type: Literal[ProductPriceAmountType.metered_unit]
    meter: MeterReference
    unit_amount: Decimal = Field(
        gt=0,
        max_digits=17,
        decimal_places=12,
        description="The price per unit in cents. Supports up to 12 decimal places.",
    )
    cap_amount: Int32 | None = Field(
        default=None, ge=0, description="Optional maximum charge in cents."
    )


class ConfigProductPriceCustom(ProductPriceCustomCreate):
    model_config = ConfigDict(extra="forbid")

    minimum_amount: int = Field(
        default=50,
        ge=0,
        description=(
            "The minimum amount the customer can pay, in cents. "
            "Set to `0` to accept free purchases."
        ),
    )
    maximum_amount: PriceAmount | None = Field(
        default=None, description="The maximum amount the customer can pay, in cents."
    )
    preset_amount: PriceAmount | None = Field(
        default=None, ge=0, description="The initial amount shown, in cents."
    )


class ConfigProductPriceSeatBased(ProductPriceSeatBasedCreate):
    model_config = ConfigDict(extra="forbid")


class ConfigProductPriceUnitBased(ProductPriceUnitBasedCreate):
    model_config = ConfigDict(extra="forbid")


class ConfigProductPriceMeteredTiers(ProductPriceCreateBase):
    model_config = ConfigDict(extra="forbid")

    amount_type: Literal[ProductPriceAmountType.metered_tiers]
    meter: MeterReference
    tiers: TiersInput = Field(description="Tiered pricing based on consumed units.")
    cap_amount: Int32 | None = Field(
        default=None, ge=0, description="Optional maximum charge in cents."
    )


ConfigProductPrice = Annotated[
    ConfigProductPriceFixed
    | ConfigProductPriceCustom
    | ConfigProductPriceSeatBased
    | ConfigProductPriceUnitBased
    | ConfigProductPriceMeteredUnit
    | ConfigProductPriceMeteredTiers,
    Discriminator("amount_type"),
    SetSchemaReference("ConfigProductPrice"),
]


class ConfigCustomField(Schema):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(
        min_length=1, description="The `slug` of an existing custom field."
    )
    required: bool = Field(
        default=False, description="Whether the customer must fill it in."
    )


class ConfigProduct(TrialConfigurationInputMixin, MetadataInputMixin, Schema):
    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(
        ...,
        min_length=1,
        description="Your identifier for the product, used to match it.",
    )
    name: ProductName
    description: ProductDescription = None
    visibility: ProductVisibility = Field(
        default=Visibility.public, description="The visibility of the product."
    )
    recurring_interval: SubscriptionRecurringInterval | None = Field(
        default=None,
        description=(
            "The recurring interval of the product. "
            "Leave it empty for a one-time purchase."
        ),
    )
    recurring_interval_count: int | None = Field(
        default=None,
        ge=1,
        le=999,
        description="Billing cycle length in intervals. Defaults to 1.",
    )
    meter_interval: MeterInterval | None = Field(
        default=None,
        description=(
            "Optional meter cycle, independent of the billing interval. "
            "It must evenly divide the billing interval, and can't be changed."
        ),
    )
    meter_interval_count: int | None = Field(
        default=None,
        ge=1,
        le=999,
        description="Meter cycle length in intervals. Defaults to 1.",
    )
    prices: list[ConfigProductPrice] = Field(
        min_length=1, description="The prices of the product."
    )
    benefits: list[BenefitReference] = Field(
        default_factory=list,
        description="The benefits granted by the product.",
    )
    custom_fields: list[ConfigCustomField] = Field(
        default_factory=list,
        description="Custom fields asked at checkout, in order.",
    )

    @model_validator(mode="after")
    def validate_recurring(self) -> Self:
        if self.recurring_interval is None:
            if self.recurring_interval_count is not None:
                raise ValueError(
                    "One-time products can't have a recurring interval count."
                )
            if self.trial_interval is not None:
                raise ValueError("One-time products can't have a trial.")
            if self.meter_interval is not None:
                raise ValueError("One-time products can't have a meter interval.")
            if any(
                isinstance(
                    price,
                    ConfigProductPriceMeteredUnit | ConfigProductPriceMeteredTiers,
                )
                for price in self.prices
            ):
                raise ValueError(
                    "Metered pricing is not supported on one-time products."
                )
            return self
        if self.recurring_interval_count is None:
            self.recurring_interval_count = 1
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
                "The meter interval must evenly divide the billing interval."
            )
        return self


class Config(Schema):
    model_config = ConfigDict(extra="forbid")

    meters: list[ConfigMeter] = Field(
        default_factory=list,
        max_length=MAXIMUM_METERS,
        description=(
            "Meters to create or update, matched by `external_id`. "
            "Omitted fields are set to their default, except `metadata`, "
            "which is left untouched when omitted. "
            "Existing meters that aren't listed are left untouched, "
            "and archived meters stay archived."
        ),
    )
    benefits: list[ConfigBenefit] = Field(
        default_factory=list,
        max_length=MAXIMUM_BENEFITS,
        description=(
            "Benefits to create or update, matched by `external_id`. "
            "Existing benefits that aren't listed are left untouched."
        ),
    )
    products: list[ConfigProduct] = Field(
        default_factory=list,
        max_length=MAXIMUM_PRODUCTS,
        description=(
            "Products to create or update, matched by `external_id`. "
            "Existing products that aren't listed are left untouched."
        ),
    )
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization to apply the config to. "
            "**Required unless you use an organization token.**"
        ),
    )


class ConfigIssueSeverity(StrEnum):
    error = "error"
    warning = "warning"


class ConfigIssueType(StrEnum):
    duplicate_external_id = "duplicate_external_id"
    interval_changed = "interval_changed"
    meter_locked = "meter_locked"
    not_supported = "not_supported"
    type_changed = "type_changed"
    unknown_event = "unknown_event"
    unknown_reference = "unknown_reference"


class ConfigIssue(Schema):
    severity: ConfigIssueSeverity = Field(
        description="`error` blocks applying the config, `warning` doesn't."
    )
    type: ConfigIssueType = Field(description="Machine-readable reason.")
    loc: list[str | int] = Field(
        description="Location of the issue in the request body."
    )
    msg: str = Field(description="Human-readable description of the issue.")
    input: Any | None = Field(description="The value at `loc`, if relevant.")


class ConfigAction(StrEnum):
    created = "created"
    updated = "updated"
    unchanged = "unchanged"


class ConfigResource(StrEnum):
    meter = "meter"
    benefit = "benefit"
    product = "product"
    custom_field = "custom_field"


class ConfigResult(Schema):
    resource: ConfigResource = Field(description="The type of resource.")
    external_id: str = Field(description="The resource's `external_id`.")
    action: ConfigAction = Field(description="What applying the config does.")


class ConfigApplyResult(Schema):
    changes: list[ConfigResult]


class ConfigFieldChange(Schema):
    field: str = Field(description="Name of the changed field.")
    before: Any | None = Field(description="Current value, `None` on create.")
    after: Any | None = Field(description="Value after applying the config.")


class ConfigChange(ConfigResult):
    diff: list[ConfigFieldChange] = Field(
        description=(
            "Fields that applying the config changes. "
            "On create, fields left empty are omitted."
        )
    )


class ConfigPlan(Schema):
    changes: list[ConfigChange]
    issues: list[ConfigIssue]


class ConfigExportMeter(Schema, MetadataOutputMixin):
    external_id: str = Field(description="Your identifier for the meter.")
    name: str = Field(description=NAME_DESCRIPTION)
    unit: MeterUnit = Field(description="The unit of the meter.")
    custom_label: str | None = Field(description="The label for the custom unit.")
    custom_multiplier: int | None = Field(
        description="The multiplier to convert from base unit to display scale."
    )
    filter: Filter = Field(
        description="The filter applied on events to calculate the meter."
    )
    aggregation: Aggregation = Field(
        description="The aggregation applied on the filtered events."
    )


class ConfigExportBenefitBase(Schema, MetadataOutputMixin):
    external_id: str = Field(description="Your identifier for the benefit.")
    description: str = Field(description="The description of the benefit.")
    visibility: BenefitVisibility = Field(description="The visibility of the benefit.")


class ConfigExportBenefitFeatureFlag(ConfigExportBenefitBase):
    type: Literal[BenefitType.feature_flag]


class ConfigExportBenefitCustom(ConfigExportBenefitBase):
    type: Literal[BenefitType.custom]
    properties: BenefitCustomOutputProperties


class ConfigExportBenefitLicenseKeys(ConfigExportBenefitBase):
    type: Literal[BenefitType.license_keys]
    properties: BenefitLicenseKeysProperties


class ConfigExportBenefitMeterCreditProperties(Schema):
    meter: str = Field(description="The `external_id` of the credited meter.")
    units: int = Field(description="Number of units credited on the meter each cycle.")
    rollover: bool = Field(
        description="Whether unused units carry over to the next cycle."
    )


class ConfigExportBenefitMeterCredit(ConfigExportBenefitBase):
    type: Literal[BenefitType.meter_credit]
    properties: ConfigExportBenefitMeterCreditProperties


ConfigExportBenefit = Annotated[
    ConfigExportBenefitCustom
    | ConfigExportBenefitFeatureFlag
    | ConfigExportBenefitLicenseKeys
    | ConfigExportBenefitMeterCredit,
    Discriminator("type"),
    SetSchemaReference("ConfigExportBenefit"),
]


class ConfigExportProductPriceBase(Schema):
    price_currency: str = Field(description="The currency of the price.")
    tax_behavior: TaxBehaviorOption | None = Field(
        description="The tax behavior of the price."
    )


class ConfigExportProductPriceFixed(ConfigExportProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.fixed]
    price_amount: int = Field(description="The price in cents.")


class ConfigExportProductPriceMeteredUnit(ConfigExportProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.metered_unit]
    meter: str = Field(description="The `external_id` of the billed meter.")
    unit_amount: Decimal = Field(description="The price per unit in cents.")
    cap_amount: int | None = Field(description="Optional maximum charge in cents.")


class ConfigExportProductPriceCustom(ConfigExportProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.custom]
    minimum_amount: int = Field(description="The minimum amount the customer can pay.")
    maximum_amount: int | None = Field(
        description="The maximum amount the customer can pay."
    )
    preset_amount: int | None = Field(description="The initial amount shown.")


class ConfigExportProductPriceSeatBased(ConfigExportProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.seat_based]
    tiers: Tiers = Field(description="Tiered pricing based on seat quantity.")
    minimum_units: int | None = Field(description="The minimum number of seats.")


class ConfigExportProductPriceUnitBased(ConfigExportProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.unit_based]
    tiers: Tiers = Field(description="Tiered pricing based on unit quantity.")
    minimum_units: int | None = Field(description="The minimum number of units.")
    unit_label: UnitLabel | None = Field(description="Per-locale unit nouns.")


class ConfigExportProductPriceMeteredTiers(ConfigExportProductPriceBase):
    amount_type: Literal[ProductPriceAmountType.metered_tiers]
    meter: str = Field(description="The `external_id` of the billed meter.")
    tiers: Tiers = Field(description="Tiered pricing based on consumed units.")
    cap_amount: int | None = Field(description="Optional maximum charge in cents.")


ConfigExportProductPrice = Annotated[
    ConfigExportProductPriceFixed
    | ConfigExportProductPriceCustom
    | ConfigExportProductPriceSeatBased
    | ConfigExportProductPriceUnitBased
    | ConfigExportProductPriceMeteredUnit
    | ConfigExportProductPriceMeteredTiers,
    Discriminator("amount_type"),
    SetSchemaReference("ConfigExportProductPrice"),
]


class ConfigExportCustomField(Schema):
    slug: str = Field(description="The `slug` of the custom field.")
    required: bool = Field(description="Whether the customer must fill it in.")


class ConfigExportProduct(Schema, MetadataOutputMixin):
    external_id: str = Field(description="Your identifier for the product.")
    name: str = Field(description="The name of the product.")
    description: str | None = Field(description="The description of the product.")
    visibility: ProductVisibility = Field(description="The visibility of the product.")
    recurring_interval: SubscriptionRecurringInterval | None = Field(
        description="The recurring interval of the product, empty if one-time."
    )
    recurring_interval_count: int | None = Field(
        description="Billing cycle length in intervals, empty if one-time."
    )
    trial_interval: TrialInterval | None = Field(
        description="The interval unit of the trial, empty without a trial."
    )
    trial_interval_count: int | None = Field(
        description="The number of trial interval units, empty without a trial."
    )
    meter_interval: MeterInterval | None = Field(
        description="The meter cycle, empty when it follows the billing interval."
    )
    meter_interval_count: int | None = Field(
        description="Meter cycle length in intervals, empty without a meter cycle."
    )
    prices: list[ConfigExportProductPrice] = Field(
        description="The prices of the product."
    )
    benefits: list[str] = Field(
        description="The `external_id` of each benefit granted by the product."
    )
    custom_fields: list[ConfigExportCustomField] = Field(
        description="Custom fields asked at checkout, in order."
    )


class ConfigExportDocument(Schema):
    meters: list[ConfigExportMeter]
    benefits: list[ConfigExportBenefit]
    products: list[ConfigExportProduct]


class ConfigSkippedReason(StrEnum):
    missing_external_id = "missing_external_id"
    archived = "archived"
    invalid = "invalid"
    not_supported = "not_supported"
    over_limit = "over_limit"
    unknown_reference = "unknown_reference"


class ConfigSkippedResource(Schema):
    resource: ConfigResource = Field(description="The type of resource.")
    id: UUID4 = Field(description="The resource ID.")
    name: str = Field(description="The resource name, or description for benefits.")
    reason: ConfigSkippedReason = Field(
        description="Why the resource isn't in the exported config."
    )


class ConfigExport(Schema):
    config: ConfigExportDocument = Field(
        description="The current config, in the same shape plan and apply accept."
    )
    skipped: list[ConfigSkippedResource] = Field(
        description="Resources left out of the exported config."
    )
