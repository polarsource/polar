"""Provider-agnostic records the adapters normalize into, so the precheck
engine and importer don't need to know which billing provider data came from."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

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
