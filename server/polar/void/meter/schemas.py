from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema
from polar.void.entitlement.schemas import SLUG_PATTERN


class MeterCreate(Schema):
    variant_id: str | None = Field(None, pattern=r"^[0-9a-f]{64}$")
    name: str = Field(min_length=3)
    slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    branch_id: UUID | None = None
    usage_reducer_id: UUID
    credit_reducer_id: UUID
    unit_amount: Decimal = Field(ge=0, max_digits=17, decimal_places=12)
    currency: str = Field("usd", min_length=3, max_length=3)


class Meter(Schema):
    id: UUID
    variant_id: str | None
    name: str
    slug: str
    branch_id: UUID | None
    usage_reducer_id: UUID
    credit_reducer_id: UUID
    unit_amount: Decimal
    currency: str
    generation_id: int
    created_at: datetime
