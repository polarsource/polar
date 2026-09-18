"""Monthly recurring revenue behind a migration, split by where it has got to.

Record counts say how much work is left; MRR says how much is at stake. An
operator picking what to chase wants the second one.

Everything is derived from the staged ledger rather than the imported Polar
subscriptions, so the same arithmetic covers revenue that has already landed and
revenue that hasn't moved yet.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from redis.exceptions import RedisError

from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.math import polar_round
from polar.merchant_migration.canonical import (
    CanonicalSubscriptionStatus,
    PriceKey,
    price_key,
    subscription_price_key_values,
)
from polar.merchant_migration.repository import CanonicalRow
from polar.models.merchant_migration_record import MerchantMigrationRecordStatus
from polar.redis import Redis

# Source subscriptions that are actually producing revenue. Matches Polar's own
# billable statuses, so a trial counts as expected revenue and a canceled
# subscription counts as nothing. Compared against the raw stored strings.
EARNING_STATUSES = frozenset(
    status.value
    for status in (
        CanonicalSubscriptionStatus.active,
        CanonicalSubscriptionStatus.trialing,
        CanonicalSubscriptionStatus.past_due,
    )
)

# How many months one billing period spans. Weeks and days are averaged over a
# calendar month; nothing else recurs, so it contributes no MRR.
_MONTHS_PER_INTERVAL: dict[str, float] = {
    "month": 1.0,
    "year": 12.0,
    "week": 7 / 30.44,
    "day": 1 / 30.44,
}


@dataclass(frozen=True)
class Money:
    """Monthly amounts in the smallest unit, per currency.

    A migration is nearly always single-currency, but a source account can price
    in several, and adding those together would be a lie.
    """

    amounts: dict[str, int] = field(default_factory=dict)

    def __add__(self, other: "Money") -> "Money":
        merged = dict(self.amounts)
        for currency, amount in other.amounts.items():
            merged[currency] = merged.get(currency, 0) + amount
        return Money(merged)

    @property
    def is_zero(self) -> bool:
        return not any(self.amounts.values())

    def by_size(self) -> list[tuple[str, int]]:
        """Currencies largest first, so the headline figure is the meaningful one."""
        return sorted(self.amounts.items(), key=lambda item: -item[1])

    @property
    def has_foreign_currency(self) -> bool:
        return any(
            currency.lower() != "usd" and amount
            for currency, amount in self.amounts.items()
        )

    def to_usd(self, rates: Mapping[str, float]) -> int | None:
        """Cents in USD, or None when a foreign currency has no rate.

        Missing a rate is a hard stop: adding the leftover foreign amount to
        the USD total would be the lie this type exists to avoid.
        """
        total = 0
        for currency, amount in self.amounts.items():
            if not amount:
                continue
            code = currency.lower()
            if code == "usd":
                total += amount
                continue
            rate = rates.get(code)
            if rate is None:
                return None
            total += polar_round(amount * rate)
        return total


@dataclass(frozen=True)
class MrrBreakdown:
    """Where a migration's recurring revenue currently sits."""

    # Imported into Polar (paused until cutover, but ours to bill).
    on_polar: Money
    # Staged and importable, still on the source.
    to_move: Money
    # Skipped or failed: revenue this migration will leave behind.
    staying: Money

    @property
    def total(self) -> Money:
        return self.on_polar + self.to_move + self.staying

    @property
    def migrated_percent(self) -> int:
        """Share of the migration's revenue already on Polar, across currencies.

        Mixing currencies in one ratio is imprecise, but the alternative is no
        headline number at all, and this is a progress indicator rather than an
        accounting figure.
        """
        total = sum(self.total.amounts.values())
        if total == 0:
            return 0
        return round(100 * sum(self.on_polar.amounts.values()) / total)

    def share_on_polar(self, rates: Mapping[str, float]) -> int:
        """Prefer a USD-weighted share when every currency can be converted."""
        total = self.total.to_usd(rates)
        on_polar = self.on_polar.to_usd(rates)
        if total and on_polar is not None:
            return round(100 * on_polar / total)
        return self.migrated_percent


def _is_earning(canonical: dict[str, Any]) -> bool:
    """Whether the source is actually billing this subscription.

    Paused collection means it isn't, and the pre-check leaves those behind, so
    counting them would inflate the revenue a migration is said to carry.
    """
    if canonical.get("paused_collection"):
        return False
    return canonical.get("status") in EARNING_STATUSES


def _monthly_amount(
    amount: int, quantity: int, interval: str | None, interval_count: int
) -> int | None:
    months = _MONTHS_PER_INTERVAL.get(interval or "")
    if months is None or interval_count < 1:
        return None
    return round(amount * quantity / (months * interval_count))


def _price_index(
    products: Sequence[CanonicalRow],
) -> dict[PriceKey, tuple[int, str, str | None, int]]:
    """Map every source price and currency to its amount and interval.

    Built across all the products handed in, not just one migration's, so it
    also covers a subscription whose product was staged by an earlier run.
    """
    index: dict[PriceKey, tuple[int, str, str | None, int]] = {}
    for _, _, _, canonical in products:
        interval = canonical.get("recurring_interval")
        interval_count = canonical.get("recurring_interval_count") or 1
        for price in canonical.get("prices") or []:
            amount = price.get("amount")
            if amount is None:
                continue
            key = price_key(price["source_id"], price["currency"])
            index[key] = (
                amount,
                price["currency"],
                interval,
                interval_count,
            )
    return index


_BUCKETS = {
    MerchantMigrationRecordStatus.imported: "on_polar",
    MerchantMigrationRecordStatus.pending: "to_move",
}
# Skipped and failed both mean "this revenue is not coming with us".
_DEFAULT_BUCKET = "staying"


def breakdown(
    products: Sequence[CanonicalRow],
    subscriptions: Sequence[CanonicalRow],
    migration_ids: Sequence[UUID],
) -> dict[UUID, MrrBreakdown]:
    """MRR per migration, from one pass over the staged subscriptions.

    Amounts accumulate as plain ints and are wrapped into `Money` once per
    migration, so a large catalog doesn't allocate a frozen copy per row.
    """
    prices = _price_index(products)
    buckets: dict[UUID, dict[str, dict[str, int]]] = {
        migration_id: {"on_polar": {}, "to_move": {}, "staying": {}}
        for migration_id in migration_ids
    }

    for migration_id, status, _, canonical in subscriptions:
        bucket = buckets.get(migration_id)
        if bucket is None:
            continue
        if not _is_earning(canonical):
            continue
        key = subscription_price_key_values(
            canonical.get("price_source_id", ""),
            canonical.get("currency"),
        )
        price = prices.get(key) if key is not None else None
        if price is None:
            continue
        amount, currency, interval, interval_count = price
        monthly = _monthly_amount(
            amount, canonical.get("quantity") or 1, interval, interval_count
        )
        if monthly is None:
            continue

        amounts = bucket[_BUCKETS.get(status, _DEFAULT_BUCKET)]
        amounts[currency] = amounts.get(currency, 0) + monthly

    return {
        migration_id: MrrBreakdown(
            on_polar=Money(bucket["on_polar"]),
            to_move=Money(bucket["to_move"]),
            staying=Money(bucket["staying"]),
        )
        for migration_id, bucket in buckets.items()
    }


USD_RATE_CACHE_TTL_SECONDS = 24 * 60 * 60
_USD_RATE_CACHE_PREFIX = "polar:fx:usd:v1"


def _usd_rate_cache_key(currency: str) -> str:
    return f"{_USD_RATE_CACHE_PREFIX}:{currency}"


async def usd_rates(
    redis: Redis, breakdowns: Sequence[MrrBreakdown]
) -> dict[str, float]:
    """Stripe FX Quotes `base_rate`s, cached 24h per currency."""
    currencies = sorted(
        {
            currency.lower()
            for breakdown in breakdowns
            for currency, amount in breakdown.total.amounts.items()
            if amount and currency.lower() != "usd"
        }
    )
    if not currencies:
        return {}

    rates: dict[str, float] = {}
    missing: list[str] = []
    for currency in currencies:
        try:
            cached = await redis.get(_usd_rate_cache_key(currency))
        except RedisError:
            cached = None
        if cached is None:
            missing.append(currency)
            continue
        try:
            rates[currency] = float(cached)
        except TypeError, ValueError:
            missing.append(currency)

    if not missing:
        return rates

    fetched = await stripe_service.get_usd_base_rates(missing)
    for currency, rate in fetched.items():
        rates[currency] = rate
        try:
            await redis.set(
                _usd_rate_cache_key(currency),
                str(rate),
                ex=USD_RATE_CACHE_TTL_SECONDS,
            )
        except RedisError:
            pass
    return rates
