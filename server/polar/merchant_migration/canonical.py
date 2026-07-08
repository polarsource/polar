"""Provider-agnostic records the adapters normalize into, so the precheck
engine and importer don't need to know which billing provider data came from."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any

from fastapi.encoders import jsonable_encoder

from polar.models.merchant_migration_record import MerchantMigrationRecordType


class CanonicalPricingScheme(StrEnum):
    fixed = "fixed"
    tiered = "tiered"
    metered = "metered"


class CanonicalSubscriptionStatus(StrEnum):
    active = "active"
    trialing = "trialing"
    past_due = "past_due"
    unpaid = "unpaid"
    paused = "paused"
    canceled = "canceled"
    other = "other"


class CanonicalCollectionMethod(StrEnum):
    charge_automatically = "charge_automatically"
    send_invoice = "send_invoice"


class CanonicalPaymentMethodType(StrEnum):
    card = "card"
    us_bank_account = "us_bank_account"
    sepa_debit = "sepa_debit"
    bacs_debit = "bacs_debit"
    link = "link"
    other = "other"

    @property
    def requires_reentry(self) -> bool:
        return self in {
            CanonicalPaymentMethodType.bacs_debit,
            CanonicalPaymentMethodType.link,
            CanonicalPaymentMethodType.other,
        }


@dataclass
class CanonicalPaymentMethod:
    source_id: str
    type: CanonicalPaymentMethodType


@dataclass
class CanonicalPrice:
    source_id: str
    currency: str
    # None when the source has no representable integer amount (e.g. a sub-cent
    # decimal price); such prices can't be imported.
    amount: int | None
    pricing_scheme: CanonicalPricingScheme


@dataclass
class CanonicalProduct:
    # In Polar the recurring interval lives on the product and a product holds
    # several prices (one per currency), so a source product is grouped per
    # interval: one CanonicalProduct = one Polar product = (source product,
    # interval), carrying its currency prices.
    source_id: str
    product_source_id: str
    name: str
    recurring_interval: str | None
    recurring_interval_count: int
    prices: list[CanonicalPrice]

    type = MerchantMigrationRecordType.product


@dataclass
class CanonicalCustomer:
    source_id: str
    email: str
    name: str | None
    country: str | None

    type = MerchantMigrationRecordType.customer


@dataclass
class CanonicalSubscription:
    source_id: str
    customer_source_id: str
    price_source_id: str
    status: CanonicalSubscriptionStatus
    collection_method: CanonicalCollectionMethod
    # End may be None: the importer derives it from current_period_start + interval.
    current_period_start: datetime | None
    current_period_end: datetime | None
    trialing: bool
    paused_collection: bool
    line_item_count: int
    quantity: int
    payment_method: CanonicalPaymentMethod | None

    type = MerchantMigrationRecordType.subscription


@dataclass
class CanonicalAccount:
    """Source-account-level facts the precheck needs but that aren't per-record."""

    country: str | None
    is_connect_platform: bool


CanonicalRecord = CanonicalProduct | CanonicalCustomer | CanonicalSubscription


def serialize(record: CanonicalRecord) -> dict[str, Any]:
    """JSON-safe dict for the ``canonical`` column; the DB serializer can't
    encode the ``CanonicalSubscription`` datetimes on its own."""
    return jsonable_encoder(record)


def _parse_datetime(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def deserialize(
    type: MerchantMigrationRecordType, data: dict[str, Any]
) -> CanonicalRecord:
    """Rebuild a canonical record from a stored ``canonical`` dict, the inverse
    of ``serialize``. Lets consumers work off the staged ledger instead of
    re-reading the source."""
    if type == MerchantMigrationRecordType.product:
        return CanonicalProduct(
            source_id=data["source_id"],
            product_source_id=data["product_source_id"],
            name=data["name"],
            recurring_interval=data["recurring_interval"],
            recurring_interval_count=data["recurring_interval_count"],
            prices=[
                CanonicalPrice(
                    source_id=price["source_id"],
                    currency=price["currency"],
                    amount=price["amount"],
                    pricing_scheme=CanonicalPricingScheme(price["pricing_scheme"]),
                )
                for price in data["prices"]
            ],
        )
    if type == MerchantMigrationRecordType.customer:
        return CanonicalCustomer(
            source_id=data["source_id"],
            email=data["email"],
            name=data["name"],
            country=data["country"],
        )
    if type == MerchantMigrationRecordType.subscription:
        payment_method = data["payment_method"]
        return CanonicalSubscription(
            source_id=data["source_id"],
            customer_source_id=data["customer_source_id"],
            price_source_id=data["price_source_id"],
            status=CanonicalSubscriptionStatus(data["status"]),
            collection_method=CanonicalCollectionMethod(data["collection_method"]),
            current_period_start=_parse_datetime(data["current_period_start"]),
            current_period_end=_parse_datetime(data["current_period_end"]),
            trialing=data["trialing"],
            paused_collection=data["paused_collection"],
            line_item_count=data["line_item_count"],
            quantity=data["quantity"],
            payment_method=CanonicalPaymentMethod(
                source_id=payment_method["source_id"],
                type=CanonicalPaymentMethodType(payment_method["type"]),
            )
            if payment_method is not None
            else None,
        )
    raise ValueError(f"Cannot deserialize record of type {type}")
