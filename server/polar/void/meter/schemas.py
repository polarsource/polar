from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema
from polar.models import Meter as MeterModel
from polar.void.entitlement.schemas import SLUG_PATTERN, MeterEntitlementState
from polar.void.metric.schemas import TimeInterval
from polar.void.schemas import PlainDecimal

from .balance import MeterCycle


class MeterCreate(Schema):
    version_id: str = Field(pattern=r"^[0-9a-f]{64}$")
    name: str = Field(min_length=3)
    slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    usage_reducer_id: UUID
    credit_reducer_id: UUID
    unit_amount: Decimal = Field(ge=0, max_digits=17, decimal_places=12)
    currency: str = Field("usd", min_length=3, max_length=3)


class Meter(Schema):
    id: UUID
    version_id: str
    name: str
    slug: str
    usage_reducer_id: UUID
    credit_reducer_id: UUID
    unit_amount: PlainDecimal
    currency: str
    created_at: datetime


Reason = Literal["ok", "no_holder", "exhausted", "access_denied", "missing_period"]


class SubscriptionRead(Schema):
    id: str
    at: datetime
    anchor: datetime
    meter_interval: TimeInterval
    meter_interval_count: int
    rollover_cap: float | None
    included: float
    limit: Literal["hard", "soft", "unlimited"]
    ended: bool


class Balance(Schema):
    at: datetime | None
    subscription: SubscriptionRead | None
    boundary: datetime | None
    boundaries: list[datetime]
    cycles: dict[datetime, MeterCycle]
    credits: float
    usage: float
    meter_id: UUID
    external_identity_id: str
    remaining: float | None
    overage: float
    limited_by: str | None
    limit: Literal["hard", "soft", "unlimited"] | None
    reason: Reason
    period_start: datetime | None
    period_end: datetime | None


class Check(Schema):
    allowed: bool
    remaining: float | None
    external_identity_id: str | None
    reason: Reason
    entitlements: list[MeterEntitlementState]
    limit: Literal["hard", "soft", "unlimited"] | None
    overage: float
    period_start: datetime | None
    period_end: datetime | None


def to_schema(meter: MeterModel) -> Meter:
    configuration = meter.deployment.configuration or {}
    definition = next(
        item for item in configuration["meters"] if item["slug"] == meter.slug
    )
    return Meter(
        id=meter.id,
        version_id=meter.version_id,
        name=meter.name,
        slug=meter.slug,
        usage_reducer_id=meter.usage_reducer_id,
        credit_reducer_id=meter.credit_reducer_id,
        unit_amount=Decimal(str(definition["unit_amount"])),
        currency=definition.get("currency", "usd"),
        created_at=meter.created_at,
    )
