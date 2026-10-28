from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any, Literal, Self

from annotated_types import Gt
from pydantic import (
    UUID4,
    BaseModel,
    ConfigDict,
    Discriminator,
    Field,
    model_validator,
)

from polar.benefit.strategies.base.schemas import (
    BENEFIT_DESCRIPTION_MAX_LENGTH,
    BENEFIT_DESCRIPTION_MIN_LENGTH,
)
from polar.enums import SubscriptionRecurringInterval, TaxBehaviorOption
from polar.kit.currency import PresentmentCurrency
from polar.kit.metadata import MetadataInputMixin, MetadataOutputType
from polar.kit.schemas import IDSchema, Int32, Schema, SetSchemaReference
from polar.kit.trial import TrialConfigurationInputMixin, TrialInterval
from polar.kit.visibility import Visibility
from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter
from polar.meter.schemas import MeterCreateBase
from polar.meter.unit import MeterUnit
from polar.models.benefit import BenefitType, BenefitVisibility
from polar.models.product import ProductVisibility
from polar.models.product_price import ProductPriceAmountType
from polar.organization.schemas import OrganizationID
from polar.product.schemas import (
    PriceAmount,
    ProductDescription,
    ProductName,
    ProductPriceCreateBase,
    ProductPriceFixedCreate,
    ProductPriceSeatBasedCreate,
    ProductPriceUnitBasedCreate,
    UnitLabel,
)
from polar.product.tiers import TiersInput, TierType
from polar.webhook.schemas import (
    AvailableAPIVersion,
    EndpointEvents,
    EndpointFormat,
    EndpointURL,
)

MAXIMUM_METERS = 100
MAXIMUM_BENEFITS = 100
MAXIMUM_PRODUCTS = 100
MAXIMUM_WEBHOOK_ENDPOINTS = 25


class ConfigDeprecationMixin(BaseModel):
    deprecated: bool = Field(
        default=False,
        exclude=True,
        description=(
            "Keeps the resource for customers who still use it, "
            "but active products and benefits can't reference it."
        ),
    )


class ConfigMeter(ConfigDeprecationMixin, MeterCreateBase):
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

ProductReference = Annotated[
    str,
    Field(
        min_length=1,
        description="The `external_id` of a product declared in the same config.",
    ),
]

BenefitReference = Annotated[
    str,
    Field(
        min_length=1,
        description="The `external_id` of a benefit declared in the same config.",
    ),
]


class ConfigBenefitBase(ConfigDeprecationMixin, MetadataInputMixin, Schema):
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
        default=Visibility.public,
        description="The visibility of the benefit.",
    )


class ConfigBenefitFeatureFlag(ConfigBenefitBase):
    type: Literal[BenefitType.feature_flag]


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
    ConfigBenefitFeatureFlag | ConfigBenefitMeterCredit,
    Discriminator("type"),
    SetSchemaReference("ConfigBenefit"),
]


class ConfigProductPriceSeatBased(ProductPriceSeatBasedCreate):
    model_config = ConfigDict(extra="forbid")

    minimum_units: int = Field(
        default=1,
        ge=1,
        description="The minimum purchasable seat quantity (inclusive).",
    )


class ConfigProductPriceUnitBased(ProductPriceUnitBasedCreate):
    model_config = ConfigDict(extra="forbid")

    minimum_units: int = Field(
        default=1,
        ge=1,
        description="The minimum purchasable unit quantity (inclusive).",
    )


class ConfigProductPriceMeteredTiers(ProductPriceCreateBase):
    model_config = ConfigDict(extra="forbid")

    amount_type: Literal[ProductPriceAmountType.metered_tiers]
    meter: MeterReference
    tiers: TiersInput
    cap_amount: Int32 | None = Field(
        default=None, ge=0, description="Optional maximum charge in cents."
    )

    @model_validator(mode="after")
    def validate_last_tier_unbounded(self) -> Self:
        if self.tiers.last_bound is not None:
            raise ValueError(
                "The last tier must be unbounded (bound set to null), "
                "since usage has no upper limit"
            )
        return self


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


ConfigProductPrice = Annotated[
    ConfigProductPriceFixed
    | ConfigProductPriceMeteredUnit
    | ConfigProductPriceSeatBased
    | ConfigProductPriceMeteredTiers
    | ConfigProductPriceUnitBased,
    Discriminator("amount_type"),
    SetSchemaReference("ConfigProductPrice"),
]


class ConfigProduct(
    ConfigDeprecationMixin, MetadataInputMixin, TrialConfigurationInputMixin, Schema
):
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
    prices: list[ConfigProductPrice] = Field(
        min_length=1, description="The prices of the product."
    )
    benefits: list[BenefitReference] = Field(
        default_factory=list,
        description="The benefits granted by the product.",
    )

    @model_validator(mode="after")
    def validate_recurring(self) -> Self:
        if self.recurring_interval is None:
            if self.recurring_interval_count is not None:
                raise ValueError(
                    "One-time products can't have a recurring interval count."
                )
            if self.trial_interval is not None or self.trial_interval_count is not None:
                raise ValueError(
                    "Trial configuration is only supported on recurring products."
                )
            if any(
                isinstance(
                    price,
                    (ConfigProductPriceMeteredUnit, ConfigProductPriceMeteredTiers),
                )
                for price in self.prices
            ):
                raise ValueError(
                    "Metered pricing is not supported on one-time products."
                )
        elif self.recurring_interval_count is None:
            self.recurring_interval_count = 1
        return self


class ConfigWebhookEndpoint(Schema):
    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(
        ...,
        min_length=1,
        description="Your identifier for the webhook endpoint, used to match it.",
    )
    url: EndpointURL
    format: EndpointFormat
    events: EndpointEvents = Field(min_length=1)
    api_version: AvailableAPIVersion = Field(
        description="The API version that'll be used in event payloads."
    )


class ConfigSettingsPayments(Schema):
    model_config = ConfigDict(extra="forbid")

    currency: PresentmentCurrency | None = Field(
        default=None,
        description=(
            "The organization's default presentment currency. "
            "Every active product must have a price in it. "
            "Left untouched when omitted."
        ),
    )
    tax: TaxBehaviorOption | None = Field(
        default=None,
        description=(
            "The organization's default tax behavior, used by prices "
            "without their own. Left untouched when omitted."
        ),
    )


class ConfigSettings(Schema):
    model_config = ConfigDict(extra="forbid")

    payments: ConfigSettingsPayments | None = Field(
        default=None,
        description="Payment settings. Left untouched when omitted.",
    )


class Config(Schema):
    model_config = ConfigDict(extra="forbid")

    settings: ConfigSettings | None = Field(
        default=None,
        description="Organization settings to update. Left untouched when omitted.",
    )
    catalog_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=256,
        description=(
            "Name of the catalog version this apply publishes, if it publishes one. "
            "Defaults to `v{n}`, n being the version's position in the "
            "organization's catalog history. Numbers never go backwards: "
            "applying an older config again publishes a new version with the "
            "next number."
        ),
    )

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
    webhooks: list[ConfigWebhookEndpoint] = Field(
        default_factory=list,
        max_length=MAXIMUM_WEBHOOK_ENDPOINTS,
        description=(
            "Webhook endpoints to create or update, matched by `external_id`. "
            "Existing endpoints that aren't listed are left untouched."
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
    currency_changed = "currency_changed"
    deprecated_reference = "deprecated_reference"
    duplicate_external_id = "duplicate_external_id"
    interval_changed = "interval_changed"
    meter_locked = "meter_locked"
    missing_currency = "missing_currency"
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
    webhook = "webhook"


class ConfigResult(Schema):
    resource: ConfigResource = Field(description="The type of resource.")
    external_id: str = Field(description="The resource's `external_id`.")
    action: ConfigAction = Field(description="What applying the config does.")


class ConfigSettingsResult(Schema):
    action: ConfigAction = Field(description="What applying the config does.")


class ConfigCatalog(IDSchema):
    name: str | None = Field(description="Name of the catalog.")


class ConfigCatalogChange(Schema):
    before: ConfigCatalog | None = Field(
        description="The live catalog before applying. `None` if no catalog exists to replace."
    )
    after: ConfigCatalog = Field(description="The catalog applying published.")


class ConfigCatalogPlan(Schema):
    before: ConfigCatalog | None = Field(
        description=(
            "The live catalog that applying replaces. "
            "`None` if the organization has no catalog yet."
        )
    )
    name: str = Field(
        description=(
            "Name of the catalog applying publishes. A default `v{n}` name moves "
            "to the next number if another apply publishes first."
        )
    )


class ConfigApplyResult(Schema):
    changes: list[ConfigResult]
    catalog: ConfigCatalogChange | None = Field(
        description="The published catalog, if applying published a new one."
    )
    settings: ConfigSettingsResult | None = Field(
        description="Result for `settings`, if in the config."
    )


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


class ConfigSettingsChange(ConfigSettingsResult):
    diff: list[ConfigFieldChange] = Field(
        description="Settings that applying the config changes."
    )


class ConfigPlan(Schema):
    changes: list[ConfigChange]
    catalog: ConfigCatalogPlan | None = Field(
        description="The catalog that applying publishes, if any."
    )
    settings: ConfigSettingsChange | None = Field(
        description="Change for `settings`, if in the config."
    )
    issues: list[ConfigIssue]


class ConfigPruneEntry(Schema):
    resource: ConfigResource = Field(description="The type of resource.")
    external_id: str = Field(description="The resource's `external_id`.")
    in_use: bool = Field(description="Whether a customer still uses the resource.")
    referenced_by: list[str] = Field(
        description=(
            "External IDs of the products and benefits staying in the config "
            "that reference the resource."
        )
    )


class ConfigPrune(Schema):
    entries: list[ConfigPruneEntry] = Field(
        description=(
            "Every deprecated resource in the config. Ones not in use "
            "and not referenced can be removed from the config."
        )
    )


# Same schema in both modes, or `Decimal` fields split into `-Input`/`-Output`.
class _ConfigRead(Schema):
    model_config = ConfigDict(extra="forbid", json_schema_mode_override="serialization")


class ConfigMeterRead(_ConfigRead):
    external_id: str
    name: str
    unit: MeterUnit
    custom_label: str | None
    custom_multiplier: int | None
    filter: Filter
    aggregation: Aggregation
    metadata: MetadataOutputType


class ConfigBenefitFeatureFlagRead(_ConfigRead):
    type: Literal[BenefitType.feature_flag]
    external_id: str
    description: str
    visibility: BenefitVisibility
    metadata: MetadataOutputType


class ConfigBenefitMeterCreditPropertiesRead(_ConfigRead):
    meter: str
    units: Int32
    rollover: bool


class ConfigBenefitMeterCreditRead(_ConfigRead):
    type: Literal[BenefitType.meter_credit]
    external_id: str
    description: str
    visibility: BenefitVisibility
    metadata: MetadataOutputType
    properties: ConfigBenefitMeterCreditPropertiesRead


ConfigBenefitRead = Annotated[
    ConfigBenefitFeatureFlagRead | ConfigBenefitMeterCreditRead,
    Discriminator("type"),
    SetSchemaReference("ConfigBenefitRead"),
]


class ConfigTierRead(_ConfigRead):
    bound: int | None
    unit_amount: Decimal


class ConfigTiersRead(_ConfigRead):
    type: TierType
    tiers: list[ConfigTierRead]


class ConfigProductPriceFixedRead(_ConfigRead):
    amount_type: Literal[ProductPriceAmountType.fixed]
    price_currency: PresentmentCurrency
    tax_behavior: TaxBehaviorOption | None
    price_amount: Int32


class ConfigProductPriceMeteredUnitRead(_ConfigRead):
    amount_type: Literal[ProductPriceAmountType.metered_unit]
    price_currency: PresentmentCurrency
    tax_behavior: TaxBehaviorOption | None
    meter: str
    unit_amount: Decimal
    cap_amount: Int32 | None


class ConfigProductPriceSeatBasedRead(_ConfigRead):
    amount_type: Literal[ProductPriceAmountType.seat_based]
    price_currency: PresentmentCurrency
    tax_behavior: TaxBehaviorOption | None
    tiers: ConfigTiersRead
    minimum_units: int


class ConfigProductPriceMeteredTiersRead(_ConfigRead):
    amount_type: Literal[ProductPriceAmountType.metered_tiers]
    price_currency: PresentmentCurrency
    tax_behavior: TaxBehaviorOption | None
    meter: str
    tiers: ConfigTiersRead
    cap_amount: Int32 | None


class ConfigProductPriceUnitBasedRead(_ConfigRead):
    amount_type: Literal[ProductPriceAmountType.unit_based]
    price_currency: PresentmentCurrency
    tax_behavior: TaxBehaviorOption | None
    tiers: ConfigTiersRead
    minimum_units: int
    unit_label: UnitLabel | None


ConfigProductPriceRead = Annotated[
    ConfigProductPriceFixedRead
    | ConfigProductPriceMeteredUnitRead
    | ConfigProductPriceSeatBasedRead
    | ConfigProductPriceMeteredTiersRead
    | ConfigProductPriceUnitBasedRead,
    Discriminator("amount_type"),
    SetSchemaReference("ConfigProductPriceRead"),
]


class ConfigProductRead(_ConfigRead):
    external_id: str
    name: str
    description: str | None
    visibility: ProductVisibility
    recurring_interval: SubscriptionRecurringInterval | None
    recurring_interval_count: int | None
    trial_interval: TrialInterval | None
    trial_interval_count: int | None
    prices: list[ConfigProductPriceRead]
    benefits: list[str]
    metadata: MetadataOutputType


class ConfigSettingsPaymentsRead(_ConfigRead):
    currency: PresentmentCurrency
    tax: TaxBehaviorOption


class ConfigSettingsRead(_ConfigRead):
    payments: ConfigSettingsPaymentsRead


class ConfigExportDocument(_ConfigRead):
    settings: ConfigSettingsRead
    meters: list[ConfigMeterRead]
    benefits: list[ConfigBenefitRead]
    products: list[ConfigProductRead]


class ConfigSkippedReason(StrEnum):
    missing_external_id = "missing_external_id"
    archived = "archived"
    invalid = "invalid"
    over_limit = "over_limit"


class ConfigSkippedResource(Schema):
    resource: ConfigResource = Field(description="The type of resource.")
    id: UUID4 = Field(description="The resource ID.")
    name: str = Field(description="The resource name.")
    reason: ConfigSkippedReason = Field(
        description="Why the resource isn't in the exported config."
    )


class ConfigExport(Schema):
    config: ConfigExportDocument = Field(
        description=(
            "The current config, in the shape plan and apply accept, "
            "without `organization_id`."
        )
    )
    skipped: list[ConfigSkippedResource] = Field(
        description=(
            "Resources left out of the exported config. "
            "At most the section's config limit is listed."
        )
    )
