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
    kr_card = "kr_card"
    us_bank_account = "us_bank_account"
    sepa_debit = "sepa_debit"
    bacs_debit = "bacs_debit"
    link = "link"
    other = "other"

    @property
    def requires_reentry(self) -> bool:
        return self in {
            CanonicalPaymentMethodType.kr_card,
            CanonicalPaymentMethodType.bacs_debit,
            CanonicalPaymentMethodType.link,
            CanonicalPaymentMethodType.other,
        }


@dataclass
class CanonicalPaymentMethod:
    source_id: str
    type: CanonicalPaymentMethodType
    # What a copy preserves, and so all there is to re-identify it by.
    last4: str | None = None
    brand: str | None = None
    exp_month: int | None = None
    exp_year: int | None = None


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
    # A discount/coupon on the source. Its amount isn't migrated yet, so importing
    # at list price would overcharge; such subscriptions are skipped for now.
    has_discount: bool = False
    # The customer already asked to stop: the source won't renew it. Nothing left
    # for Polar to take over, so the cutover leaves it where it is.
    cancel_at_period_end: bool = False
    # When the source trial ends, so the cutover can keep the subscription
    # trialing on Polar until then instead of billing it early.
    trial_end: datetime | None = None
    # This migration already stopped it on the source. Set when re-reading at
    # cutover, so a retry after a crash finishes the move instead of reading its
    # own cancellation as the customer having churned.
    stopped_for_migration: bool = False
    # The renewal day before any month-end clamping. A period boundary can't be
    # trusted for it: a 31st anchor reads as Feb 28 in a February period.
    anchor_day: int | None = None
    currency: str | None = None

    type = MerchantMigrationRecordType.subscription


@dataclass
class CanonicalAccount:
    """Source-account-level facts the precheck needs but that aren't per-record."""

    country: str | None
    # The source is a Connect platform *and* has connected accounts, whose data
    # can't be copied. A platform with none has nothing to leave behind.
    has_connected_accounts: bool


CanonicalRecord = CanonicalProduct | CanonicalCustomer | CanonicalSubscription
PriceKey = tuple[str, str]


def price_key(source_id: str, currency: str) -> PriceKey:
    return source_id, currency.lower()


def canonical_price_key(price: CanonicalPrice) -> PriceKey:
    return price_key(price.source_id, price.currency)


def subscription_price_key(subscription: CanonicalSubscription) -> PriceKey | None:
    return subscription_price_key_values(
        subscription.price_source_id, subscription.currency
    )


def subscription_price_key_values(
    source_id: str,
    currency: str | None,
) -> PriceKey | None:
    if currency is None:
        return None
    return price_key(source_id, currency)


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
    match type:
        case MerchantMigrationRecordType.product:
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
        case MerchantMigrationRecordType.customer:
            return CanonicalCustomer(
                source_id=data["source_id"],
                email=data["email"],
                name=data["name"],
                country=data["country"],
            )
        case MerchantMigrationRecordType.subscription:
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
                    last4=payment_method.get("last4"),
                    brand=payment_method.get("brand"),
                    exp_month=payment_method.get("exp_month"),
                    exp_year=payment_method.get("exp_year"),
                )
                if payment_method is not None
                else None,
                has_discount=data.get("has_discount", False),
                cancel_at_period_end=data.get("cancel_at_period_end", False),
                trial_end=_parse_datetime(data.get("trial_end")),
                stopped_for_migration=data.get("stopped_for_migration", False),
                anchor_day=data.get("anchor_day"),
                currency=data.get("currency"),
            )
        case _:
            raise ValueError(f"Cannot deserialize record of type {type}")
