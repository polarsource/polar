import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import AwareDatetime, Field, field_validator

from polar.kit.schemas import Schema
from polar.models import VoidSubscriptionStatus as SubscriptionStatus
from polar.void.event.schemas import EventCreate
from polar.void.product.schemas import Product


class SubscriptionCreate(Schema):
    product_id: uuid.UUID = Field(
        description="A product of the active deployment's version."
    )
    external_identity_id: str = Field(min_length=1, max_length=255)
    starts_at: AwareDatetime | None = Field(
        default=None,
        description="Anchor for every boundary. Defaults to now; never in the future.",
    )
    ends_at: AwareDatetime | None = Field(
        default=None,
        description="Import an already-ended subscription: canceled at this past "
        "moment, with its cancel events stamped there. Must follow starts_at.",
    )

    @field_validator("starts_at", "ends_at")
    @classmethod
    def supported_timestamp(cls, value: datetime | None) -> datetime | None:
        return EventCreate.supported_timestamp(value) if value is not None else None


class SubscriptionCancel(Schema):
    at_period_end: bool = Field(
        True,
        description="Keep access until the next boundary. False ends it now.",
    )


class ProductSubscription(Schema):
    id: uuid.UUID
    product: Product
    external_identity_id: str
    status: SubscriptionStatus
    started_at: datetime
    canceled_at: datetime | None
    ends_at: datetime | None = Field(
        description="When access stops. Unset while running without a cancel."
    )
    current_period_start: datetime | None = Field(
        description="Unset for one-time products and ended subscriptions."
    )
    current_period_end: datetime | None
    created_at: datetime


class SubscriptionCycleMeter(Schema):
    meter_id: uuid.UUID
    slug: str
    usage: float
    unit_amount: Decimal
    amount: Decimal


class SubscriptionCycle(Schema):
    """One closed period, priced at read time from the stored meter cycles."""

    period_start: datetime
    period_end: datetime
    currency: str
    fixed_amount: Decimal
    meters: list[SubscriptionCycleMeter]
    total: Decimal


class SubscriptionRebuild(Schema):
    """What re-projecting rows from the lifecycle events changed."""

    subscriptions: int = Field(description="Distinct subscription ids in the stream.")
    created: int
    updated: int
    unchanged: int
    orphaned: list[uuid.UUID] = Field(
        description="Rows with no lifecycle events behind them. Left in place."
    )
    applied: bool
