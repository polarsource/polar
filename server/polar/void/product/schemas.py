from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Annotated, Literal

from pydantic import BaseModel, Field

from polar.kit.schemas import Schema
from polar.void.entitlement.schemas import SLUG_PATTERN, Entitlement
from polar.void.meter.schemas import Meter

if TYPE_CHECKING:
    from polar.models import VoidProduct as ProductModel

BillingInterval = Literal["day", "week", "month", "year"]


class RecurringPrice(BaseModel):
    type: Literal["recurring"]
    interval: BillingInterval
    interval_count: int = Field(1, ge=1)
    amount: Decimal = Field(
        ge=0, max_digits=19, decimal_places=6, description="Fixed amount per interval."
    )
    currency: str = Field(min_length=3, max_length=3)


class OneTimePrice(BaseModel):
    type: Literal["one_time"]
    amount: Decimal = Field(ge=0, max_digits=19, decimal_places=6)
    currency: str = Field(min_length=3, max_length=3)


ProductPrice = Annotated[RecurringPrice | OneTimePrice, Field(discriminator="type")]


class MeterTerms(BaseModel):
    included: float = Field(default=0, ge=0, allow_inf_nan=False)
    limit: Literal["hard", "soft", "unlimited"] = "hard"
    rollover_cap: float | None = Field(default=0, ge=0, allow_inf_nan=False)


class ProductCreate(BaseModel):
    version_id: str = Field(pattern=r"^[0-9a-f]{64}$")
    slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    name: str = Field(min_length=1)
    description: str | None = None
    price: ProductPrice
    meter_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="Meters billed at each boundary. Recurring products only.",
    )
    meter_terms: dict[str, MeterTerms] = Field(default_factory=dict)
    entitlement_ids: list[uuid.UUID] = Field(default_factory=list)


class RecurringPriceRead(Schema):
    type: Literal["recurring"]
    interval: BillingInterval
    interval_count: int
    amount: Decimal
    currency: str


class OneTimePriceRead(Schema):
    type: Literal["one_time"]
    amount: Decimal
    currency: str


ProductPriceRead = Annotated[
    RecurringPriceRead | OneTimePriceRead, Field(discriminator="type")
]


class MeterTermsRead(Schema):
    included: float
    limit: Literal["hard", "soft", "unlimited"]
    rollover_cap: float | None


class Product(Schema):
    version_id: str
    id: uuid.UUID
    slug: str
    name: str
    description: str | None
    price: ProductPriceRead
    meters: list[Meter]
    meter_terms: dict[str, MeterTermsRead]
    entitlements: list[Entitlement]
    created_at: datetime


def price_of(product: ProductModel) -> RecurringPriceRead | OneTimePriceRead:
    """The wire price of a product row."""
    if product.price_type == "recurring":
        assert product.interval is not None
        return RecurringPriceRead(
            type="recurring",
            interval=product.interval,  # type: ignore[arg-type]
            interval_count=product.interval_count,
            amount=product.amount,
            currency=product.currency,
        )
    return OneTimePriceRead(
        type="one_time", amount=product.amount, currency=product.currency
    )


def to_schema(product: ProductModel) -> Product:
    return Product(
        id=product.id,
        slug=product.slug,
        version_id=product.version_id,
        name=product.name,
        description=product.description,
        price=price_of(product),
        meters=[Meter.model_validate(m, from_attributes=True) for m in product.meters],
        meter_terms={
            key: MeterTermsRead.model_validate(value)
            for key, value in product.meter_terms.items()
        },
        entitlements=[
            Entitlement.model_validate(e, from_attributes=True)
            for e in product.entitlements
        ],
        created_at=product.created_at,
    )
