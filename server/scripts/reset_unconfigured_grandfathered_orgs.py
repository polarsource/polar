"""
Reset grandfathered orgs that never finished setup so they re-onboard.

Picks ACTIVE/CREATED orgs whose only review is the grandfathering backfill
and that lack an active product, or both a checkout link and an access
token. Sends them back to CREATED, clears submitted details, removes the
grandfathered review, and resets the account's payout delay to the new
7-day default (only if it was still at the legacy 0).

Usage:
    cd server
    uv run python -m scripts.reset_unconfigured_grandfathered_orgs            # dry-run
    uv run python -m scripts.reset_unconfigured_grandfathered_orgs --execute  # apply
"""

import asyncio
import json
from datetime import UTC, datetime

import structlog
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models.organization import STATUS_CAPABILITIES, OrganizationStatus
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()

configure_script_console_logging()


# Identifies the OrganizationReview row inserted by the 2025-09-04
# backfill migration. Both columns must match — `model_used` alone could
# clash with a future agent provider literally named "grandfathered".
_GRANDFATHERED_MODEL = "grandfathered"
_GRANDFATHERED_REASON = "Grandfathered organization"

_TARGET_STATUSES: list[str] = [
    OrganizationStatus.ACTIVE.value,
    OrganizationStatus.CREATED.value,
]
_TARGET_WHERE = """
    o.status = ANY(:target_statuses)
    AND EXISTS (
        SELECT 1 FROM organization_reviews r
        WHERE r.organization_id = o.id
          AND r.model_used = :grandfathered_model
          AND r.reason = :grandfathered_reason
          AND r.deleted_at IS NULL
    )
    AND (
        NOT EXISTS (
            SELECT 1 FROM products p
            WHERE p.organization_id = o.id
              AND p.deleted_at IS NULL
              AND p.is_archived = false
        )
        OR (
            NOT EXISTS (
                SELECT 1 FROM checkout_links cl
                WHERE cl.organization_id = o.id
                  AND cl.deleted_at IS NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM organization_access_tokens oat
                WHERE oat.organization_id = o.id
                  AND oat.deleted_at IS NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM oauth2_tokens t
                WHERE t.organization_id = o.id
                  AND t.deleted_at IS NULL
                  AND t.access_token_revoked_at IS NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM oauth2_tokens t
                JOIN user_organizations uo ON uo.user_id = t.user_id
                WHERE uo.organization_id = o.id
                  AND t.deleted_at IS NULL
                  AND t.access_token_revoked_at IS NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM personal_access_tokens pat
                JOIN user_organizations uo ON uo.user_id = pat.user_id
                WHERE uo.organization_id = o.id
                  AND pat.deleted_at IS NULL
            )
        )
    )
    -- Skip orgs that have ever had a checkout session.
    AND NOT EXISTS (
        SELECT 1 FROM checkouts c
        WHERE c.organization_id = o.id
    )
    -- Skip orgs that have ever had an order. Covers active subscriptions
    -- too, since any live subscription in the target set has an order.
    AND NOT EXISTS (
        SELECT 1 FROM orders ord
        WHERE ord.organization_id = o.id
    )
"""


_FILTER_PARAMS: dict[str, object] = {
    "target_statuses": _TARGET_STATUSES,
    "grandfathered_model": _GRANDFATHERED_MODEL,
    "grandfathered_reason": _GRANDFATHERED_REASON,
}


async def _show_targets(session: AsyncSession, *, sample_limit: int) -> int:
    """Print the total count and a sample of orgs that would be reset."""
    breakdown_result = await session.execute(
        text(f"""
            SELECT o.status, COUNT(*) AS n
            FROM organizations o
            WHERE {_TARGET_WHERE}
            GROUP BY o.status
            ORDER BY o.status
        """),
        _FILTER_PARAMS,
    )
    breakdown = breakdown_result.all()
    total = sum(row.n for row in breakdown)

    if total == 0:
        console.print("[green]No grandfathered orgs match — nothing to reset.")
        return 0

    breakdown_table = Table(title="Targets by current status")
    breakdown_table.add_column("Status", style="cyan")
    breakdown_table.add_column("Count", justify="right")
    for row in breakdown:
        breakdown_table.add_row(row.status, str(row.n))
    console.print(breakdown_table)

    sample_result = await session.execute(
        text(f"""
            SELECT
                o.id,
                o.slug,
                o.name,
                o.status,
                o.created_at,
                EXISTS (
                    SELECT 1 FROM products p
                    WHERE p.organization_id = o.id
                      AND p.deleted_at IS NULL
                      AND p.is_archived = false
                ) AS has_product,
                EXISTS (
                    SELECT 1 FROM checkout_links cl
                    WHERE cl.organization_id = o.id
                      AND cl.deleted_at IS NULL
                ) AS has_checkout_link,
                EXISTS (
                    SELECT 1 FROM organization_access_tokens oat
                    WHERE oat.organization_id = o.id
                      AND oat.deleted_at IS NULL
                ) AS has_access_token
            FROM organizations o
            WHERE {_TARGET_WHERE}
            ORDER BY o.created_at DESC
            LIMIT :sample_limit
        """),
        {**_FILTER_PARAMS, "sample_limit": sample_limit},
    )

    table = Table(
        title=f"Grandfathered orgs without product, or without "
        f"checkout link + access token (showing {sample_limit} of {total})"
    )
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Name")
    table.add_column("Status", style="cyan")
    table.add_column("Created", style="yellow")
    table.add_column("Product", justify="center")
    table.add_column("Checkout link", justify="center")
    table.add_column("API key", justify="center")

    for row in sample_result.all():
        table.add_row(
            str(row.id),
            row.slug,
            row.name or "",
            row.status,
            str(row.created_at.date()),
            "[green]✓" if row.has_product else "[red]✗",
            "[green]✓" if row.has_checkout_link else "[red]✗",
            "[green]✓" if row.has_access_token else "[red]✗",
        )

    console.print(table)
    console.print(f"\n[yellow]Total to reset: {total}")
    return total


async def _show_status_summary(session: AsyncSession) -> None:
    result = await session.execute(
        text("""
            SELECT status, COUNT(*) AS total
            FROM organizations
            GROUP BY status
            ORDER BY status
        """)
    )

    table = Table(title="Organization Status Distribution")
    table.add_column("Status", style="cyan")
    table.add_column("Total", justify="right")

    for status, total in result.all():
        table.add_row(status, str(total))

    console.print(table)


async def _run_reset(
    sessionmaker: async_sessionmaker[AsyncSession],
    *,
    batch_size: int,
    sleep_seconds: float,
) -> int:
    """Reset matching orgs in batches.

    Per batch, in a single transaction:

      1. Pick a batch of matching org ids.
      2. Reset each org: status → CREATED, capabilities → CREATED defaults,
         status_updated_at → now(), details → {}, details_submitted_at → NULL,
         internal_notes appended. Bypasses ``Organization.set_status`` because
         ACTIVE → CREATED is not in ``ALLOWED_STATUS_TRANSITIONS``.
      3. Soft-delete the grandfathered ``organization_reviews`` row so the
         next ``maybe_activate`` call doesn't auto-promote the org back to
         ACTIVE. The merchant's re-submission will create a fresh review.
      4. Bump the linked ``accounts.payout_transaction_delay`` from the
         legacy 0 to the new 7-day default. Skipped if an operator already
         set a custom (non-zero) delay.
    """
    now_ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M")
    note_line = (
        f"[{now_ts} UTC] Reset to CREATED: grandfathered org missing a "
        f"product, or missing both a checkout link and an organization "
        f"access token. Cleared details, removed grandfathered review, "
        f"reset payout delay to 7 days."
    )
    created_capabilities = json.dumps(STATUS_CAPABILITIES[OrganizationStatus.CREATED])

    select_targets_sql = text(f"""
        SELECT o.id FROM organizations o
        WHERE {_TARGET_WHERE}
        ORDER BY o.id
        LIMIT :limit
    """)

    update_orgs_sql = text("""
        UPDATE organizations
        SET status = :created_status,
            status_updated_at = now(),
            capabilities = CAST(:capabilities AS JSONB),
            details = '{}'::jsonb,
            details_submitted_at = NULL,
            internal_notes = CASE
                WHEN internal_notes IS NULL OR internal_notes = ''
                THEN :note
                ELSE internal_notes || E'\\n\\n' || :note
            END
        WHERE id = ANY(:ids)
    """)

    soft_delete_reviews_sql = text("""
        UPDATE organization_reviews
        SET deleted_at = now()
        WHERE organization_id = ANY(:ids)
          AND model_used = :grandfathered_model
          AND reason = :grandfathered_reason
          AND deleted_at IS NULL
    """)

    reset_payout_delay_sql = text("""
        UPDATE accounts a
        SET payout_transaction_delay = INTERVAL '7 days'
        FROM organizations o
        WHERE o.account_id = a.id
          AND o.id = ANY(:ids)
          AND a.payout_transaction_delay = INTERVAL '0'
    """)

    total_updated = 0
    batch_number = 0

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        transient=False,
    ) as progress:
        task = progress.add_task(
            "[cyan]Resetting grandfathered orgs: Batch 0 — 0 reset", total=None
        )

        while True:
            async with sessionmaker() as session:
                target_ids = (
                    (
                        await session.execute(
                            select_targets_sql,
                            {**_FILTER_PARAMS, "limit": batch_size},
                        )
                    )
                    .scalars()
                    .all()
                )

                if not target_ids:
                    progress.update(
                        task,
                        description=f"[green]✓ Complete: {total_updated} orgs reset",
                    )
                    break

                await session.execute(
                    update_orgs_sql,
                    {
                        "created_status": OrganizationStatus.CREATED.value,
                        "capabilities": created_capabilities,
                        "note": note_line,
                        "ids": target_ids,
                    },
                )
                await session.execute(
                    soft_delete_reviews_sql,
                    {**_FILTER_PARAMS, "ids": target_ids},
                )
                await session.execute(
                    reset_payout_delay_sql,
                    {"ids": target_ids},
                )
                await session.commit()
                rows_updated = len(target_ids)

                batch_number += 1
                total_updated += rows_updated
                progress.update(
                    task,
                    description=(
                        f"[cyan]Resetting grandfathered orgs: "
                        f"Batch {batch_number} — {total_updated} reset"
                    ),
                )

            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

    return total_updated


@cli.command()
@typer_async
async def reset_unconfigured_grandfathered_orgs(
    execute: bool = typer.Option(
        False, help="Actually run the reset (default: dry-run)"
    ),
    sample_limit: int = typer.Option(
        50, help="How many target orgs to display in the dry-run preview"
    ),
    batch_size: int = typer.Option(500, help="Number of orgs to update per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    log = structlog.get_logger()

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        if not execute:
            console.rule(
                "[bold]Dry-run: reset ACTIVE/CREATED grandfathered orgs without product, or without checkout link + access token"
            )
            log.info("Running in DRY-RUN mode (no changes will be made)")
            log.info("Use --execute to actually reset organizations")
            console.print()

            async with sessionmaker() as session:
                await _show_status_summary(session)
                console.print()
                await _show_targets(session, sample_limit=sample_limit)

            return

        console.rule(
            "[bold]Executing: reset ACTIVE/CREATED grandfathered orgs without product, or without checkout link + access token"
        )
        log.warning("Running in EXECUTE mode — will modify data!")

        async with sessionmaker() as session:
            console.print("[bold]Before:")
            await _show_status_summary(session)
            console.print()
            count = await _show_targets(session, sample_limit=sample_limit)

        if count == 0:
            log.info("Nothing to do — no matching grandfathered orgs")
            return

        console.print()
        total = await _run_reset(
            sessionmaker,
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
        )

        log.info("Reset complete", total_reset=total)
        console.print()

        async with sessionmaker() as session:
            console.print("[bold]After:")
            await _show_status_summary(session)

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
