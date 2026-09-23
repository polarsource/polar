from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Annotated, Literal

from pydantic import BaseModel, Field

from polar.kit.currency import get_currency_decimal_factor
from polar.kit.schemas import Schema
from polar.models import Meter as MeterModel
from polar.models import ProductPriceFixed, ProductPriceMeteredUnit
from polar.void.entitlement.schemas import SLUG_PATTERN, Entitlement
from polar.void.meter.schemas import Meter
from polar.void.meter.schemas import to_schema as meter_schema

if TYPE_CHECKING:
    from polar.models import Product as ProductModel

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


def meters_of(product: ProductModel) -> list[MeterModel]:
    return [
        price.meter
        for price in product.prices
        if isinstance(price, ProductPriceMeteredUnit)
    ]


def price_of(product: ProductModel) -> RecurringPriceRead | OneTimePriceRead:
    price = next(
        price for price in product.prices if isinstance(price, ProductPriceFixed)
    )
    amount = Decimal(price.price_amount) / get_currency_decimal_factor(
        price.price_currency
    )
    if product.is_recurring:
        assert product.recurring_interval is not None
        assert product.recurring_interval_count is not None
        return RecurringPriceRead.model_validate(
            {
                "type": "recurring",
                "interval": product.recurring_interval,
                "interval_count": product.recurring_interval_count,
                "amount": amount,
                "currency": price.price_currency,
            }
        )
    return OneTimePriceRead(
        type="one_time", amount=amount, currency=price.price_currency
    )


def to_schema(product: ProductModel) -> Product:
    return Product(
        id=product.id,
        slug=product.slug,
        version_id=product.version_id,
        name=product.name,
        description=product.description,
        price=price_of(product),
        meters=[meter_schema(meter) for meter in meters_of(product)],
        meter_terms={
            key: MeterTermsRead.model_validate(value)
            for key, value in product.meter_terms.items()
        },
        entitlements=[
            Entitlement.model_validate(benefit, from_attributes=True)
            for benefit in product.benefits
        ],
        created_at=product.created_at,
    )
