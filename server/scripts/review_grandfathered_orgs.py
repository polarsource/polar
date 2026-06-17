"""
Run the organization review agent (with autoreview) for grandfathered orgs.

Grandfathered orgs are those auto-approved by the 2025-09-04 backfill
(``organization_reviews.model_used = 'grandfathered'``); they were activated
without ever going through a real agent review. This script puts each ACTIVE
grandfathered org through the exact same flow a payment-threshold crossing
triggers:

  1. Flip ACTIVE -> REVIEW via ``Organization.set_status`` (updates
     capabilities + ``status_updated_at``, holds payouts).
  2. Enqueue ``organization.under_review``, which enqueues the review agent
     with ``auto_approve_eligible=True``.

Autoreview verdict handling (done by the agent task):
  * APPROVE              -> org auto-returned to ACTIVE within seconds.
  * DENY / NEEDS_HUMAN   -> org stays in REVIEW (payouts held) for a human to
                            triage in the backoffice.

Flipping to REVIEW is disruptive: payouts are held until the agent clears the
org. Run it incrementally with ``--limit`` and watch the worker queue. Agent
jobs are spread over ``--spread-minutes`` to avoid saturating the queue / the
LLM provider.

Re-runs are safe with the default ``--skip-already-reviewed``: an APPROVE
verdict returns the org to ACTIVE within seconds, so status alone does NOT keep
it out of the target set — what does is the agent-review record left behind,
which ``--skip-already-reviewed`` (on by default) excludes. Disabling that flag
makes re-runs re-review every clean org again, and each auto-approve doubles its
``next_review_threshold``, so keep it on unless you have a reason not to.

The per-batch DB commit and the job enqueue are not atomic across Postgres and
Redis: if the flush fails after a batch commits, those orgs are left in REVIEW
with no enqueued agent job and a re-run will not pick them up (they are no
longer ACTIVE). Recover them from the backoffice "run review agent" action.

Usage:
    cd server
    uv run python -m scripts.review_grandfathered_orgs                      # dry-run
    uv run python -m scripts.review_grandfathered_orgs --execute            # apply
    uv run python -m scripts.review_grandfathered_orgs --execute --limit 200
"""

import asyncio

import dramatiq
import structlog
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

from polar import tasks  # noqa: F401  -- registers dramatiq actors
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models.organization import OrganizationStatus
from polar.organization.repository import OrganizationRepository
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import enqueue_job, make_bulk_job_delay_calculator
from polar.worker._enqueue import JobQueueManager
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()

configure_script_console_logging()


# Identifies the OrganizationReview row inserted by the 2025-09-04 backfill
# migration. Both columns must match — ``model_used`` alone could clash with a
# future agent provider literally named "grandfathered".
_GRANDFATHERED_MODEL = "grandfathered"
_GRANDFATHERED_REASON = "Grandfathered organization"

_GRANDFATHERED_EXISTS = """
    EXISTS (
        SELECT 1 FROM organization_reviews r
        WHERE r.organization_id = o.id
          AND r.model_used = :grandfathered_model
          AND r.reason = :grandfathered_reason
          AND r.deleted_at IS NULL
    )
"""

_NOT_AGENT_REVIEWED = """
    NOT EXISTS (
        SELECT 1 FROM organization_agent_reviews ar
        WHERE ar.organization_id = o.id
          AND ar.deleted_at IS NULL
    )
"""

_PARAMS: dict[str, object] = {
    "active_status": OrganizationStatus.ACTIVE.value,
    "grandfathered_model": _GRANDFATHERED_MODEL,
    "grandfathered_reason": _GRANDFATHERED_REASON,
}


def _build_target_where(*, skip_already_reviewed: bool) -> str:
    clauses = [
        "o.deleted_at IS NULL",
        "o.status = :active_status",
        _GRANDFATHERED_EXISTS,
    ]
    if skip_already_reviewed:
        clauses.append(_NOT_AGENT_REVIEWED)
    return " AND ".join(clauses)


async def _count(session: AsyncSession, where: str) -> int:
    result = await session.execute(
        text(f"SELECT COUNT(*) FROM organizations o WHERE {where}"),
        _PARAMS,
    )
    return result.scalar_one()


async def _show_grandfathered_breakdown(session: AsyncSession) -> None:
    result = await session.execute(
        text(f"""
            SELECT o.status, COUNT(*) AS n
            FROM organizations o
            WHERE o.deleted_at IS NULL AND {_GRANDFATHERED_EXISTS}
            GROUP BY o.status
            ORDER BY o.status
        """),
        _PARAMS,
    )
    table = Table(title="Grandfathered orgs by current status")
    table.add_column("Status", style="cyan")
    table.add_column("Count", justify="right")
    for row in result.all():
        table.add_row(row.status, str(row.n))
    console.print(table)


async def _show_targets(
    session: AsyncSession,
    *,
    where: str,
    skip_already_reviewed: bool,
    sample_limit: int,
) -> int:
    total = await _count(session, where)

    if skip_already_reviewed:
        all_active = await _count(
            session, _build_target_where(skip_already_reviewed=False)
        )
        excluded = all_active - total
        console.print(
            f"[dim]ACTIVE grandfathered: {all_active} "
            f"({excluded} already agent-reviewed, skipped)"
        )

    if total == 0:
        console.print("[green]No ACTIVE grandfathered orgs match — nothing to review.")
        return 0

    result = await session.execute(
        text(f"""
            SELECT
                o.id,
                o.slug,
                o.name,
                o.created_at,
                o.total_balance,
                o.next_review_threshold
            FROM organizations o
            WHERE {where}
            ORDER BY o.created_at DESC
            LIMIT :sample_limit
        """),
        {**_PARAMS, "sample_limit": sample_limit},
    )

    table = Table(
        title=f"ACTIVE grandfathered orgs to review "
        f"(showing {min(sample_limit, total)} of {total})"
    )
    table.add_column("ID", style="dim")
    table.add_column("Slug")
    table.add_column("Name")
    table.add_column("Created", style="yellow")
    table.add_column("Balance", justify="right")
    table.add_column("Next threshold", justify="right")

    for row in result.all():
        table.add_row(
            str(row.id),
            row.slug,
            row.name or "",
            str(row.created_at.date()),
            str(row.total_balance),
            str(row.next_review_threshold),
        )

    console.print(table)
    console.print(f"\n[yellow]Total to review: {total}")
    return total


async def _run_reviews(
    sessionmaker: async_sessionmaker[AsyncSession],
    *,
    where: str,
    total_count: int,
    batch_size: int,
    limit: int,
    spread_minutes: int,
    sleep_seconds: float,
) -> int:
    """Flip ACTIVE grandfathered orgs to REVIEW and enqueue the review agent.

    Per batch, in a single transaction: pick a batch of matching org ids, load
    each org, ``set_status(REVIEW)``, and enqueue ``organization.under_review``
    (which fans out to ``organization_review.run_agent`` with auto-approve
    enabled). The DB commit happens before the JobQueueManager flush, so the
    org is REVIEW in the DB before its agent job is visible to the worker.

    The loop is self-consuming and self-terminating: every selected org either
    gets flipped to REVIEW (and so drops out of ``where``) or is skipped because
    a concurrent change already moved it out of ACTIVE (so it no longer matches
    ``where`` either). Either way the matching set strictly shrinks each batch,
    so the empty-``SELECT`` break is the only termination condition needed.
    """
    broker = dramatiq.get_broker()
    calculate_delay = make_bulk_job_delay_calculator(
        total_count, max_spread_ms=spread_minutes * 60_000
    )

    select_targets_sql = text(f"""
        SELECT o.id FROM organizations o
        WHERE {where}
        ORDER BY o.id
        LIMIT :batch_limit
    """)

    processed = 0
    batch_number = 0

    async with create_redis("script") as redis:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task(
                "[cyan]Reviewing grandfathered orgs: Batch 0 — 0 enqueued",
                total=None,
            )

            while True:
                remaining = (limit - processed) if limit > 0 else batch_size
                if remaining <= 0:
                    break
                batch_limit = min(batch_size, remaining)

                async with sessionmaker() as session:
                    async with JobQueueManager.open(broker, redis):
                        target_ids = (
                            (
                                await session.execute(
                                    select_targets_sql,
                                    {**_PARAMS, "batch_limit": batch_limit},
                                )
                            )
                            .scalars()
                            .all()
                        )

                        if not target_ids:
                            break

                        org_repository = OrganizationRepository.from_session(session)
                        for organization_id in target_ids:
                            organization = await org_repository.get_by_id(
                                organization_id
                            )
                            if (
                                organization is None
                                or organization.status != OrganizationStatus.ACTIVE
                            ):
                                continue

                            organization.set_status(OrganizationStatus.REVIEW)
                            session.add(organization)
                            enqueue_job(
                                "organization.under_review",
                                organization_id=organization.id,
                                delay=calculate_delay(processed),
                            )
                            processed += 1

                        await session.commit()
                        # JobQueueManager.open() flushes on context exit, i.e.
                        # after the commit above.

                batch_number += 1
                progress.update(
                    task,
                    description=(
                        f"[cyan]Reviewing grandfathered orgs: "
                        f"Batch {batch_number} — {processed} enqueued"
                    ),
                )

                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)

            progress.update(
                task,
                description=f"[green]✓ Complete: {processed} orgs enqueued for review",
            )

    return processed


@cli.command()
@typer_async
async def review_grandfathered_orgs(
    execute: bool = typer.Option(
        False,
        help="Actually flip orgs to REVIEW and enqueue the agent (default: dry-run)",
    ),
    skip_already_reviewed: bool = typer.Option(
        True,
        help=(
            "Skip grandfathered orgs that already have an agent review. "
            "Disabling re-reviews already-approved orgs on every run and "
            "doubles their next_review_threshold each time — keep it on."
        ),
    ),
    limit: int = typer.Option(
        0, help="Max orgs to process this run (0 = all matching orgs)"
    ),
    batch_size: int = typer.Option(
        100, help="Number of orgs to flip + enqueue per batch"
    ),
    spread_minutes: int = typer.Option(
        30, help="Spread the enqueued agent jobs across this many minutes"
    ),
    sleep_seconds: float = typer.Option(0.5, help="Seconds to sleep between batches"),
    sample_limit: int = typer.Option(
        50, help="How many target orgs to display in the dry-run preview"
    ),
) -> None:
    log = structlog.get_logger()
    where = _build_target_where(skip_already_reviewed=skip_already_reviewed)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        if not execute:
            console.rule(
                "[bold]Dry-run: review ACTIVE grandfathered orgs (with autoreview)"
            )
            log.info("Running in DRY-RUN mode (no changes will be made)")
            log.info("Use --execute to flip orgs to REVIEW and enqueue the agent")
            console.print()

            async with sessionmaker() as session:
                await _show_grandfathered_breakdown(session)
                console.print()
                await _show_targets(
                    session,
                    where=where,
                    skip_already_reviewed=skip_already_reviewed,
                    sample_limit=sample_limit,
                )
            return

        console.rule(
            "[bold]Executing: review ACTIVE grandfathered orgs (with autoreview)"
        )
        log.warning(
            "EXECUTE mode — will flip orgs ACTIVE→REVIEW and enqueue the review agent"
        )

        async with sessionmaker() as session:
            console.print("[bold]Before:")
            await _show_grandfathered_breakdown(session)
            console.print()
            total = await _show_targets(
                session,
                where=where,
                skip_already_reviewed=skip_already_reviewed,
                sample_limit=sample_limit,
            )

        if total == 0:
            log.info("Nothing to do — no matching grandfathered orgs")
            return

        if limit > 0:
            total = min(total, limit)

        console.print()
        processed = await _run_reviews(
            sessionmaker,
            where=where,
            total_count=total,
            batch_size=batch_size,
            limit=limit,
            spread_minutes=spread_minutes,
            sleep_seconds=sleep_seconds,
        )

        log.info("Review enqueue complete", processed=processed)
        console.print()

        async with sessionmaker() as session:
            console.print("[bold]After:")
            await _show_grandfathered_breakdown(session)

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
