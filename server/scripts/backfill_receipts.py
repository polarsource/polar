"""
Backfill ``receipt_number`` for paid orders, then enable the receipts flag.

For each target organization, the script does two things, in order:

1. Allocate a ``receipt_number`` for every paid order with a succeeded payment
   that doesn't already have one. Allocation is bulked per customer: a single
   ``UPDATE`` statement per customer per batch keeps the round-trip count low.
2. Flip ``feature_settings.receipts_enabled`` to true on the organization.

The flag flips last, so customers don't see the Download Receipt button until
every historical order has a number — no window where some orders 404.

All allocation primitives live in this script: it bypasses the runtime
``is_receipts_enabled`` gate and the per-row ``SELECT FOR UPDATE`` lock used
by ``receipt_service.allocate`` (safe because the org's flag is still off
during backfill, so no concurrent allocator). Keeping these primitives out
of the production repos/services avoids dead code there.

Usage:
    cd server

    # Dry-run (default) — count candidates for one org:
    uv run python -m scripts.backfill_receipts <organization_id>

    # Execute one org:
    uv run python -m scripts.backfill_receipts <organization_id> --execute

    # Dry-run across every org:
    uv run python -m scripts.backfill_receipts --all

    # Execute across every org (smallest first):
    uv run python -m scripts.backfill_receipts --all --execute
"""

import asyncio
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from itertools import groupby

import typer
from sqlalchemy import (
    String,
    Uuid,
    column,
    select,
    tuple_,
    update,
    values,
)
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import joinedload
from sqlalchemy.sql import ColumnElement

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Customer, Order, Organization, Payment
from polar.models.payment import PaymentStatus
from polar.postgres import create_async_engine
from polar.receipt.service import RECEIPT_NUMBER_PREFIX

from .helper import configure_script_console_logging, typer_async

cli = typer.Typer()

BATCH_SIZE = 500
SLEEP_SECONDS = 0.1


@dataclass
class OrgResult:
    organization_id: uuid.UUID
    name: str
    allocated: int = 0
    flag_enabled: bool = False


@dataclass
class BackfillResult:
    total_allocated: int = 0
    total_flag_enabled: int = 0


def _has_succeeded_payment() -> ColumnElement[bool]:
    """EXISTS subquery filtering Order rows to those with a succeeded payment.

    ``Order.paid`` is a status check, so we semi-join ``payments`` to exclude
    $0 / fully-discounted orders that look paid but have no payment row.
    """
    return (
        select(Payment.order_id)
        .where(
            Payment.order_id == Order.id,
            Payment.status == PaymentStatus.succeeded,
        )
        .exists()
    )


async def _list_unallocated_orders_for_organization(
    session: AsyncSession,
    organization_id: uuid.UUID,
    *,
    after: tuple[uuid.UUID, uuid.UUID] | None,
    limit: int,
) -> Sequence[Order]:
    """Page through receipt-eligible orders for an org.

    Ordered by ``(customer_id, id)`` so each customer's orders cluster in the
    same batch — the bulk allocator does one counter UPDATE plus one orders
    UPDATE per (customer, batch) pair, so fewer customers per batch means
    fewer round-trips. ``after`` is a composite keyset of the last row's
    ``(customer_id, id)``.
    """
    statement = (
        select(Order)
        .where(
            Order.organization_id == organization_id,
            Order.receipt_number.is_(None),
            Order.deleted_at.is_(None),
            Order.paid,
            _has_succeeded_payment(),
        )
        .options(joinedload(Order.customer))
        .order_by(Order.customer_id.asc(), Order.id.asc())
        .limit(limit)
    )
    if after is not None:
        statement = statement.where(tuple_(Order.customer_id, Order.id) > after)
    result = await session.execute(statement)
    return result.unique().scalars().all()


async def _list_organizations_with_unallocated_paid_orders(
    session: AsyncSession,
) -> Sequence[uuid.UUID]:
    """Organization IDs that have receipt-eligible orders, balance-ordered.

    Sorted by ``Organization.total_balance`` ascending (NULLs first), so the
    backfill ``--all`` mode lands smaller orgs before the largest ones.
    Snapshot is taken at call time — orgs that gain their first eligible
    order mid-run are missed; operators re-run to pick them up.

    Materialized eagerly rather than streamed: a server-side cursor held for
    the full ``--all`` run would be killed by asyncpg's ``command_timeout``,
    and the result set fits comfortably in memory.
    """
    eligible_order = (
        select(Order.id)
        .where(
            Order.organization_id == Organization.id,
            Order.receipt_number.is_(None),
            Order.deleted_at.is_(None),
            Order.paid,
            _has_succeeded_payment(),
        )
        .exists()
    )
    statement = (
        select(Organization.id)
        .where(
            Organization.deleted_at.is_(None),
            eligible_order,
        )
        .order_by(Organization.total_balance.asc().nullsfirst())
    )
    result = await session.execute(statement)
    return [row[0] for row in result.all()]


async def _bulk_allocate_for_customer(
    session: AsyncSession,
    customer: Customer,
    orders: Sequence[Order],
) -> int:
    """Allocate receipt numbers for many orders of one customer at once.

    Caller guarantees (a) no concurrent allocator (the runtime path is gated
    on the org's flag, so calling this while the flag is still off — the
    intended backfill state — is safe), and (b) every passed order has a
    succeeded payment (the page query enforces this). Orders that already
    have a ``receipt_number`` are filtered out for idempotency.

    Does not write the new number back to in-memory ``Order`` instances —
    that would mark them dirty and re-trigger per-row UPDATEs at commit time,
    defeating the bulk path. Use ``session.refresh`` to read it.

    Uses ``UPDATE … FROM (VALUES …)`` rather than a 500-branch ``CASE``:
    Postgres builds a hash table from the VALUES and joins on it, so the
    per-row cost is O(1) instead of O(N) and the parsed SQL stays small.
    """
    eligible = [o for o in orders if o.receipt_number is None]
    if not eligible:
        return 0

    # Atomically reserve a contiguous range of len(eligible) receipt numbers.
    increment_stmt = (
        update(Customer)
        .where(Customer.id == customer.id)
        .values(receipt_next_number=Customer.receipt_next_number + len(eligible))
        .returning(Customer.receipt_next_number)
    )
    next_value = (await session.execute(increment_stmt)).scalar_one()
    start_number = next_value - len(eligible)

    short_id = customer.short_id_str
    mapping = {
        order.id: f"{RECEIPT_NUMBER_PREFIX}-{short_id}-{(start_number + i):04d}"
        for i, order in enumerate(eligible)
    }

    data = values(
        column("order_id", Uuid),
        column("number", String),
        name="data",
    ).data(list(mapping.items()))
    bulk_update_stmt = (
        update(Order)
        .values(receipt_number=data.c.number)
        .where(Order.id == data.c.order_id)
        .execution_options(synchronize_session=False)
    )
    await session.execute(bulk_update_stmt)

    return len(eligible)


async def run_backfill_for_org(
    *,
    session: AsyncSession,
    organization_id: uuid.UUID,
    batch_size: int = BATCH_SIZE,
    sleep_seconds: float = SLEEP_SECONDS,
) -> OrgResult:
    organization = await session.get(Organization, organization_id)
    if organization is None:
        raise RuntimeError(f"Organization {organization_id} not found")

    result = OrgResult(organization_id=organization.id, name=organization.name)
    typer.echo(
        f"Backfilling receipts for organization {organization.name} ({organization.id})"
    )

    last_keyset: tuple[uuid.UUID, uuid.UUID] | None = None
    while True:
        orders = await _list_unallocated_orders_for_organization(
            session, organization_id, after=last_keyset, limit=batch_size
        )
        if not orders:
            break

        # Page query orders by (customer_id, id) so groupby clusters cleanly.
        for _, group in groupby(orders, key=lambda o: o.customer_id):
            customer_orders = list(group)
            customer = customer_orders[0].customer
            result.allocated += await _bulk_allocate_for_customer(
                session, customer, customer_orders
            )

        last_keyset = (orders[-1].customer_id, orders[-1].id)
        await session.commit()

        typer.echo(f"  allocated={result.allocated}")

        if sleep_seconds > 0:
            await asyncio.sleep(sleep_seconds)

    if not organization.is_receipts_enabled:
        organization.feature_settings = {
            **organization.feature_settings,
            "receipts_enabled": True,
        }
        await session.commit()
        result.flag_enabled = True
        typer.echo("  receipts_enabled flag set to true")
    else:
        typer.echo("  receipts_enabled flag was already true")

    return result


async def _process_org(
    *,
    sessionmaker: async_sessionmaker[AsyncSession],
    organization_id: uuid.UUID,
    batch_size: int,
    sleep_seconds: float,
    summary: BackfillResult,
) -> None:
    # Per-org session so a failure on one doesn't poison the rest.
    async with sessionmaker() as session:
        org_result = await run_backfill_for_org(
            session=session,
            organization_id=organization_id,
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )
    summary.total_allocated += org_result.allocated
    if org_result.flag_enabled:
        summary.total_flag_enabled += 1


async def _resolve_target_ids(
    *,
    sessionmaker: async_sessionmaker[AsyncSession],
    organization_id: uuid.UUID | None,
    all_orgs: bool,
) -> list[uuid.UUID]:
    """Print the preview and return the org IDs to backfill."""
    async with sessionmaker() as session:
        if all_orgs:
            target_ids = list(
                await _list_organizations_with_unallocated_paid_orders(session)
            )
            typer.echo(
                f"Found {len(target_ids)} organization(s) with unallocated "
                "paid orders (smallest balance first)."
            )
            for org_id in target_ids:
                typer.echo(f"  {org_id}")
            return target_ids

        assert organization_id is not None
        organization = await session.get(Organization, organization_id)
        if organization is None:
            typer.echo(f"Error: Organization {organization_id} not found", err=True)
            raise typer.Exit(1)
        typer.echo(f"Organization: {organization.name} ({organization.id})")
        typer.echo(f"Current receipts_enabled flag: {organization.is_receipts_enabled}")
        return [organization_id]


def _print_summary(summary: BackfillResult, organizations_processed: int) -> None:
    typer.echo("\n=== Backfill Summary ===")
    typer.echo(f"  organizations processed: {organizations_processed}")
    typer.echo(f"  allocated: {summary.total_allocated}")
    typer.echo(f"  flag flipped this run: {summary.total_flag_enabled}")


@cli.command()
@typer_async
async def backfill(
    organization_id: uuid.UUID | None = typer.Argument(
        None, help="Organization ID to backfill (omit with --all to do every org)"
    ),
    all_orgs: bool = typer.Option(
        False, "--all", help="Backfill every organization with unallocated orders"
    ),
    execute: bool = typer.Option(
        False, help="Actually run the backfill (default: dry-run)"
    ),
    batch_size: int = typer.Option(
        BATCH_SIZE, help="Number of orders to fetch per batch"
    ),
    sleep_seconds: float = typer.Option(
        SLEEP_SECONDS, help="Seconds to sleep between batches to ease DB load"
    ),
) -> None:
    """Backfill receipt_number for paid orders, then enable the receipts flag."""
    configure_script_console_logging()

    if (organization_id is None) != all_orgs:
        typer.echo("Error: pass exactly one of <organization_id> or --all", err=True)
        raise typer.Exit(1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    summary = BackfillResult()

    try:
        target_ids = await _resolve_target_ids(
            sessionmaker=sessionmaker,
            organization_id=organization_id,
            all_orgs=all_orgs,
        )

        if not execute:
            typer.echo(
                "\nDry-run — pass --execute to allocate receipt numbers and "
                "enable the flag(s)."
            )
            return

        if not target_ids:
            typer.echo("\nNothing to do.")
            return

        for org_id in target_ids:
            await _process_org(
                sessionmaker=sessionmaker,
                organization_id=org_id,
                batch_size=batch_size,
                sleep_seconds=sleep_seconds,
                summary=summary,
            )
    finally:
        await engine.dispose()

    _print_summary(summary, organizations_processed=len(target_ids))


if __name__ == "__main__":
    cli()
