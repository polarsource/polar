import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from polar.models.void_deployment import VoidDeploymentStatus
from polar.void.activity.schemas import DeployActivity
from polar.void.entitlement.schemas import SLUG_PATTERN as KEY_PATTERN
from polar.void.judge.schemas import JudgeWindow
from polar.void.product.schemas import MeterTerms, ProductPrice
from polar.void.reducer.schemas import ReducerCreate
from polar.void.schemas import PlainDecimal

from .config_hash import configuration_hash


class DeployReducer(ReducerCreate):
    slug: str = Field(min_length=1, pattern=KEY_PATTERN)


class DeployMeter(BaseModel):
    slug: str = Field(min_length=1, pattern=KEY_PATTERN)
    reducer: str = Field(description="Slug of a scalar reducer in this deploy.")
    credit_reducer: str | None = Field(
        default=None,
        min_length=1,
        pattern=KEY_PATTERN,
        description="Slug of a sum reducer in this deploy supplying credits. "
        "When omitted, a credit.granted reducer is created automatically.",
    )
    unit_amount: Decimal = Field(ge=0, max_digits=17, decimal_places=12)
    currency: str = Field("usd", min_length=3, max_length=3)


class DeployEntitlement(BaseModel):
    slug: str = Field(min_length=1, pattern=KEY_PATTERN)
    name: str | None = None
    description: str | None = None


class DeployProductMeter(MeterTerms):
    slug: str = Field(min_length=1, pattern=KEY_PATTERN)


class DeployProduct(BaseModel):
    slug: str = Field(min_length=1, pattern=KEY_PATTERN)
    name: str = Field(min_length=1)
    description: str | None = None
    price: ProductPrice
    meters: list[str | DeployProductMeter] = Field(
        default_factory=list, description="Slugs of meters in this deploy."
    )
    entitlements: list[str] = Field(
        default_factory=list, description="Slugs of entitlements in this deploy."
    )


class DeployMeterSignal(BaseModel):
    slug: str = Field(min_length=1, pattern=KEY_PATTERN)
    kind: Literal["meter"]
    meter: str = Field(
        min_length=1,
        pattern=KEY_PATTERN,
        description="Slug of the meter whose remaining balance the thresholds read.",
    )
    enter_below: float = Field(
        gt=0, description="Active once remaining drops below this."
    )
    exit_at_least: float = Field(
        description="Inactive once remaining is at least this."
    )

    @model_validator(mode="after")
    def hysteresis(self) -> Self:
        if self.exit_at_least <= self.enter_below:
            raise ValueError("signal thresholds must have enter_below < exit_at_least")
        return self


class DeploySemanticSignal(BaseModel):
    slug: str = Field(min_length=1, pattern=KEY_PATTERN)
    kind: Literal["semantic"]
    meter: str = Field(
        min_length=1,
        pattern=KEY_PATTERN,
        description="Slug of the meter whose recent events Jev reads.",
    )
    when: str = Field(
        min_length=1,
        max_length=512,
        description="The question Jev answers with a noul, verbatim.",
    )
    over: JudgeWindow = Field(
        default_factory=lambda: JudgeWindow(amount=1, unit="hour"),
        description="How far back the events go. Defaults to the last hour.",
    )
    enter_above: float = Field(description="Active once the noul rises above this.")
    exit_below: float = Field(description="Inactive once the noul falls below this.")

    @model_validator(mode="after")
    def hysteresis(self) -> Self:
        if not (0 < self.exit_below < self.enter_above <= 1):
            raise ValueError(
                "signal thresholds must have 0 < exit_below < enter_above <= 1"
            )
        return self


DeploySignal = Annotated[
    DeployMeterSignal | DeploySemanticSignal, Field(discriminator="kind")
]


class PricePreviewWindow(BaseModel):
    start: date = Field(description="Inclusive UTC date, using processed buckets.")
    end: date = Field(description="Exclusive UTC date.")

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if self.start >= self.end:
            raise ValueError("preview start must be before end")
        return self


class DeployConfiguration(BaseModel):
    """The deployable definitions alone, as stored on a deployment."""

    reducers: list[DeployReducer] = []
    meters: list[DeployMeter] = []
    entitlements: list[DeployEntitlement] = []
    products: list[DeployProduct] = []
    activities: list[DeployActivity] = []
    signals: list[DeploySignal] = []


class DeployCreate(DeployConfiguration):
    model_config = ConfigDict(extra="forbid")

    @property
    def version_id(self) -> str:
        return configuration_hash(self)

    checksum: str = Field(
        min_length=1,
        description="Hash of the config this was compiled from. Stored with the "
        "deployment; clients send it back on every request.",
    )
    dry_run: bool = Field(
        False, description="Compute the plan against current state; write nothing."
    )
    activate: bool = Field(
        False,
        description="Activate the deployment once applied. Requires an organization "
        "that has passed review.",
    )
    preview: PricePreviewWindow | None = Field(
        None, description="Compare changed usage prices without applying them."
    )

    @model_validator(mode="after")
    def preview_is_read_only(self) -> Self:
        if any(r.slug == "void-identity-entitlements" for r in self.reducers):
            raise ValueError("Identity entitlements use a system-managed reducer")
        if self.preview is not None and not self.dry_run:
            raise ValueError("price preview requires dry_run")
        if self.activate and self.dry_run:
            raise ValueError("a dry run cannot activate")
        return self


Action = Literal["create", "replace", "update", "unchanged", "orphan"]


class PricePreviewCustomer(BaseModel):
    external_id: str
    name: str | None
    billable_units: Decimal
    current_amount: Decimal
    proposed_amount: Decimal
    difference: Decimal


class MeterPricePreview(BaseModel):
    window: PricePreviewWindow
    currency: str
    current_unit_amount: PlainDecimal
    proposed_unit_amount: PlainDecimal
    customers: list[PricePreviewCustomer]
    billable_units: Decimal
    current_amount: Decimal
    proposed_amount: Decimal
    difference: Decimal
    unavailable: str | None
    excluded_customers: list[str]


class DeployEntry(BaseModel):
    kind: Literal["reducer", "meter", "entitlement", "product", "activity"]
    key: str
    action: Action
    reason: str | None
    id: uuid.UUID | None = Field(
        description="The server id after apply. Unset on a dry run create."
    )
    price_preview: MeterPricePreview | None


class Deploy(BaseModel):
    version_id: str = Field(description="SHA-256 of the normalized configuration.")
    id: uuid.UUID | None = Field(description="Unset on a dry run.")
    checksum: str
    applied: bool
    status: VoidDeploymentStatus | None = Field(description="Unset on a dry run.")
    has_configuration: bool = Field(
        description="Whether the configuration is stored, so the version can be "
        "used as a scenario base. False for deployments created before configurations were kept."
    )
    entries: list[DeployEntry]
    created_at: datetime
