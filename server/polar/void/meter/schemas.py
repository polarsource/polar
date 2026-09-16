from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema
from polar.void.entitlement.schemas import SLUG_PATTERN, MeterEntitlementState
from polar.void.metric.schemas import TimeInterval

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
    unit_amount: Decimal
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
