"""Monthly recurring revenue behind a migration, split by where it has got to.

Record counts say how much work is left; MRR says how much is at stake. An
operator picking what to chase wants the second one.

Everything is derived from the staged ledger rather than the imported Polar
subscriptions, so the same arithmetic covers revenue that has already landed and
revenue that hasn't moved yet.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from uuid import UUID

from polar.merchant_migration.canonical import (
    CanonicalSubscriptionStatus,
)
from polar.merchant_migration.repository import CanonicalRow
from polar.models.merchant_migration_record import MerchantMigrationRecordStatus

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


def _monthly_amount(
    amount: int, quantity: int, interval: str | None, interval_count: int
) -> int | None:
    months = _MONTHS_PER_INTERVAL.get(interval or "")
    if months is None or interval_count < 1:
        return None
    return round(amount * quantity / (months * interval_count))


def _price_index(
    products: Sequence[CanonicalRow],
) -> dict[str, tuple[int, str, str | None, int]]:
    """Map every source price id to (amount, currency, interval, interval count).

    Built across all the products handed in, not just one migration's: source
    price ids are unique per provider, so a shared index also covers a
    subscription whose product was staged by an earlier run.
    """
    index: dict[str, tuple[int, str, str | None, int]] = {}
    for _, _, _, canonical in products:
        interval = canonical.get("recurring_interval")
        interval_count = canonical.get("recurring_interval_count") or 1
        for price in canonical.get("prices") or []:
            amount = price.get("amount")
            if amount is None:
                continue
            index[price["source_id"]] = (
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
        if canonical.get("status") not in EARNING_STATUSES:
            continue
        price = prices.get(canonical.get("price_source_id", ""))
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
