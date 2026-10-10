from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any, Literal, Self

from annotated_types import Gt
from pydantic import UUID4, ConfigDict, Discriminator, Field, model_validator

from polar.benefit.strategies.base.schemas import (
    BENEFIT_DESCRIPTION_MAX_LENGTH,
    BENEFIT_DESCRIPTION_MIN_LENGTH,
)
from polar.enums import SubscriptionRecurringInterval
from polar.kit.metadata import MetadataInputMixin, MetadataOutputMixin
from polar.kit.schemas import Int32, Schema, SetSchemaReference
from polar.kit.visibility import Visibility
from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter
from polar.meter.schemas import NAME_DESCRIPTION, MeterCreateBase
from polar.meter.unit import MeterUnit
from polar.models.benefit import BenefitType
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
)

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
    | ConfigProductPriceSeatBased,
    Discriminator("amount_type"),
    SetSchemaReference("ConfigProductPrice"),
]


class ConfigProduct(MetadataInputMixin, Schema):
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
            if any(
                isinstance(price, ConfigProductPriceMeteredUnit)
                for price in self.prices
            ):
                raise ValueError(
                    "Metered pricing is not supported on one-time products."
                )
        elif self.recurring_interval_count is None:
            self.recurring_interval_count = 1
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


class ConfigExportDocument(Schema):
    meters: list[ConfigExportMeter]


class ConfigSkippedReason(StrEnum):
    missing_external_id = "missing_external_id"
    archived = "archived"
    invalid = "invalid"
    over_limit = "over_limit"


class ConfigSkippedMeter(Schema):
    resource: ConfigResource = Field(description="The type of resource.")
    id: UUID4 = Field(description="The meter ID.")
    name: str = Field(description="The meter name.")
    reason: ConfigSkippedReason = Field(
        description="Why the meter isn't in the exported config."
    )


class ConfigExport(Schema):
    config: ConfigExportDocument = Field(
        description="The current config, in the same shape plan and apply accept."
    )
    skipped: list[ConfigSkippedMeter] = Field(
        description="Meters left out of the exported config."
    )
