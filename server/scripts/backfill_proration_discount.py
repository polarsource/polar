"""Backfill: apply the discount to pending prorations that were billed gross.

Policy A — product applicability gates redemption, not the subscription's
lifetime: once a discount is attached it applies to every charge and credit
regardless of the product being billed, mirroring the recurring cycle.

Historically the debit-proration path (and, briefly, the credit path under
PR #13622) gated on `is_applicable`, so switching onto/away from a product the
discount didn't cover produced a *gross* proration while the recurring charge for
that same plan was net. That breaks conservation: a plan switched onto is debited
at its full rate but credited net when switched away, over-charging the customer
(e.g. the alphaXiv account's 7 Go<->Pro switches).

This backfill finds pending proration entries that carry no discount on a
subscription that has one, and rewrites them to the net amount the fixed code now
produces:

    discount_amount = discount.get_discount_amount(base, currency)   # un-prorated
    amount          = round((base - discount_amount) * pct)

Scope guard: only entries whose switch (`event_id`) has a *sibling* entry that
already carries a discount are corrected. That proves the discount was attached at
switch time — the pre-#13622 credit path applied it unconditionally, so a
discounted sibling always exists for a genuine ineligible-product switch. It
excludes gross prorations that are gross simply because no discount existed yet
(the discount was added to the subscription afterwards), which must stay gross.

Entries already carrying a discount are left untouched (already net). Anything
invoiced (`order_item_id` set) is out of scope — those became orders and need a
separate remediation.

Run:
    uv run python -m scripts.backfill_proration_discount backfill --dry-run
    uv run python -m scripts.backfill_proration_discount backfill
"""

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

import typer
from sqlalchemy import Select, and_, exists, or_, select
from sqlalchemy.orm import aliased, joinedload

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import BillingEntry, ProductPrice, Subscription
from polar.models.billing_entry import BillingEntryType
from polar.models.subscription import SubscriptionStatus
from polar.product.guard import is_fixed_price, is_seat_price
from polar.subscription.update import _calculate_time_proration

from .helper import configure_script_logging, typer_async

cli = typer.Typer()


@dataclass
class Correction:
    entry_id: UUID
    subscription_id: UUID
    direction: str
    currency: str
    base_amount: int
    old_amount: int
    new_amount: int
    new_discount: int


def _select_candidates() -> Select[tuple[BillingEntry]]:
    # Pending, non-deleted prorations (credit or debit) that carry no discount on
    # a subscription that has one, but whose switch (event_id) has a sibling entry
    # that DOES carry a discount — proving the discount was attached at switch
    # time, so the gross entry is the ineligible-product bug rather than a
    # pre-discount proration.
    sibling = aliased(BillingEntry)
    discounted_sibling = exists().where(
        and_(
            sibling.event_id == BillingEntry.event_id,
            sibling.id != BillingEntry.id,
            sibling.deleted_at.is_(None),
            sibling.discount_amount.is_not(None),
            sibling.discount_amount > 0,
        )
    )
    return (
        select(BillingEntry)
        .join(Subscription, Subscription.id == BillingEntry.subscription_id)
        .options(
            joinedload(BillingEntry.product_price).joinedload(ProductPrice.product),
            joinedload(BillingEntry.subscription).joinedload(Subscription.discount),
        )
        .where(
            BillingEntry.type == BillingEntryType.proration,
            BillingEntry.order_item_id.is_(None),
            BillingEntry.deleted_at.is_(None),
            or_(
                BillingEntry.discount_amount.is_(None),
                BillingEntry.discount_amount == 0,
            ),
            Subscription.discount_id.is_not(None),
            # Only subscriptions that can still bill: correcting a pending entry on
            # a canceled/ended subscription is inert churn — it never invoices.
            Subscription.status.in_(SubscriptionStatus.billable_statuses()),
            discounted_sibling,
        )
        .order_by(BillingEntry.subscription_id, BillingEntry.created_at)
    )


def _proration_pct(entry: BillingEntry, subscription: Subscription) -> Decimal:
    # While the switch's cycle is still current (the pending precondition), the
    # period boundaries are recoverable from the subscription. An interval change
    # or reset opens a fresh cycle at applies_at, so the proration covers the whole
    # new period (pct == 1).
    if entry.end_timestamp == subscription.current_period_end:
        period_start = subscription.current_period_start
    else:
        period_start = entry.start_timestamp
    return _calculate_time_proration(
        period_start, entry.end_timestamp, entry.start_timestamp
    )


def _build_correction(entry: BillingEntry) -> Correction | None:
    subscription = entry.subscription
    assert subscription is not None
    discount = subscription.discount
    if discount is None:
        return None
    if entry.amount is None or entry.currency is None:
        return None

    price = entry.product_price
    if is_fixed_price(price):
        base_amount = price.price_amount
    elif is_seat_price(price) and subscription.seats is not None:
        base_amount = price.calculate_amount(subscription.seats)
    else:
        typer.echo(f"SKIP {entry.id}: unsupported price {price.id}; needs review")
        return None

    try:
        new_discount = discount.get_discount_amount(base_amount, entry.currency)
    except KeyError:
        # Fixed discount not configured in this currency: it genuinely does not
        # apply here (a currency gate, unlike product applicability). Leave gross.
        return None
    if new_discount <= 0:
        return None

    pct = _proration_pct(entry, subscription)
    # Guard: the stored (gross) amount must be reconstructable, else an assumption
    # is wrong (unexpected period, rolled-over cycle) — skip rather than guess.
    if round(base_amount * pct) != entry.amount:
        typer.echo(
            f"SKIP {entry.id}: gross reconstruction mismatch "
            f"(stored={entry.amount}, expected={round(base_amount * pct)})"
        )
        return None

    return Correction(
        entry_id=entry.id,
        subscription_id=subscription.id,
        direction=entry.direction.value,
        currency=entry.currency,
        base_amount=base_amount,
        old_amount=entry.amount,
        new_amount=round((base_amount - new_discount) * pct),
        new_discount=new_discount,
    )


async def run_backfill(
    *, dry_run: bool = False, session: AsyncSession | None = None
) -> list[Correction]:
    engine = None
    own_session = False
    if session is None:
        engine = _create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.backfill_proration_discount",
            debug=False,
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        )
        session = create_async_sessionmaker(engine)()
        own_session = True

    corrections: list[Correction] = []
    try:
        result = await session.execute(_select_candidates())
        for entry in result.scalars().unique().all():
            correction = _build_correction(entry)
            if correction is None:
                continue
            corrections.append(correction)
            if not dry_run:
                entry.amount = correction.new_amount
                entry.discount_amount = correction.new_discount

        by_currency: dict[str, int] = {}
        typer.echo(
            f"{'entry':38} {'sub':38} {'dir':>6} {'cur':>4} {'base':>8} "
            f"{'old':>8} {'new':>8} {'disc':>8} {'Δ':>8}"
        )
        for c in corrections:
            delta = c.new_amount - c.old_amount
            by_currency[c.currency] = by_currency.get(c.currency, 0) + delta
            typer.echo(
                f"{str(c.entry_id):38} {str(c.subscription_id):38} {c.direction:>6} "
                f"{c.currency:>4} {c.base_amount:>8} {c.old_amount:>8} "
                f"{c.new_amount:>8} {c.new_discount:>8} {delta:>8}"
            )
        typer.echo(f"\n{'DRY RUN — ' if dry_run else ''}{len(corrections)} entries")
        for currency, delta in sorted(by_currency.items()):
            typer.echo(f"  net change {currency.upper()}: {delta} minor units")

        if not dry_run:
            await session.commit()
    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()

    return corrections


@cli.command()
@typer_async
async def backfill(
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Report corrections without writing"
    ),
) -> None:
    configure_script_logging()
    await run_backfill(dry_run=dry_run)


if __name__ == "__main__":
    cli()
