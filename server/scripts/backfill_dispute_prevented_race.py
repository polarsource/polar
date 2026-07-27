"""Reconcile disputes stuck at ``needs_response`` despite a successful
prevention refund, caused by the concurrent ``charge.dispute.*`` race.

When Stripe handles a dispute via Rapid Dispute Resolution it emits
``charge.dispute.created`` (``needs_response``) and ``charge.dispute.closed``
(``lost``) within ~0.5s. Before the row lock in ``upsert_from_stripe`` those two
events were processed concurrently, and a late ``created`` write could clobber
the ``closed`` resolution — leaving the dispute at ``needs_response`` even though
a ``dispute_prevention`` refund had already succeeded.

This script finds those disputes and, for each, retrieves the dispute from
Stripe as the source of truth:
  - Stripe reports it closed (``lost``/``won``/``warning_closed``) → apply the
    ``prevented`` outcome the race dropped: set the status, revoke benefits, and
    close the support case (posting the ``dispute_prevented`` milestone).
  - Stripe still reports it open → leave it untouched; it's genuinely in-flight
    and the live path (now lock-serialized) will resolve it when the close
    lands.

Idempotent: a remediated dispute is no longer ``needs_response`` so it drops out
of the candidate set — the script is safe to re-run or resume.

Usage:
    cd server

    # Dry-run (default) — retrieves from Stripe and prints the decision per
    # dispute without writing:
    uv run python -m scripts.backfill_dispute_prevented_race

    # Apply:
    uv run python -m scripts.backfill_dispute_prevented_race --execute
"""

from collections.abc import Sequence

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import Select, select

from polar.dispute.repository import DisputeRepository
from polar.dispute.service import dispute as dispute_service
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Dispute, Refund
from polar.models.dispute import DisputeStatus
from polar.models.refund import RefundReason, RefundStatus
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
configure_script_console_logging()
log = structlog.get_logger()


def _candidates_statement() -> Select[tuple[Dispute]]:
    has_prevention_refund = (
        select(Refund.id)
        .where(
            Refund.dispute_id == Dispute.id,
            Refund.status == RefundStatus.succeeded,
            Refund.reason == RefundReason.dispute_prevention,
        )
        .exists()
    )
    return (
        select(Dispute)
        .where(
            Dispute.status == DisputeStatus.needs_response,
            Dispute.deleted_at.is_(None),
            Dispute.payment_processor_id.is_not(None),
            has_prevention_refund,
        )
        .order_by(Dispute.created_at)
    )


def _render(rows: Sequence[tuple[Dispute, str, str]]) -> None:
    table = Table(title=f"Prevented-race candidates ({len(rows)})")
    table.add_column("Dispute", style="dim")
    table.add_column("Created", style="dim")
    table.add_column("Stripe status")
    table.add_column("Action")
    for dispute, stripe_status, action in rows:
        style = "green" if action.startswith("→") else "yellow"
        table.add_row(
            str(dispute.id),
            str(dispute.created_at.date()),
            stripe_status,
            f"[{style}]{action}[/{style}]",
        )
    console.print(table)


@cli.command()
@typer_async
async def backfill_dispute_prevented_race(
    execute: bool = typer.Option(
        False, help="Apply the remediation (default: dry-run)"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    mode = "EXECUTE" if execute else "DRY-RUN"
    console.rule(f"[bold]Backfill dispute prevented-race — {mode}")

    rows: list[tuple[Dispute, str, str]] = []
    remediated = skipped_open = errored = 0

    try:
        async with sessionmaker() as session:
            repository = DisputeRepository.from_session(session)
            statement = _candidates_statement().options(*repository.get_eager_options())
            disputes = (await session.execute(statement)).scalars().all()

            for dispute in disputes:
                assert dispute.payment_processor_id is not None
                try:
                    stripe_dispute = await stripe_service.get_dispute(
                        dispute.payment_processor_id
                    )
                except Exception as e:
                    errored += 1
                    rows.append((dispute, "—", f"error — {type(e).__name__}"))
                    log.warning(
                        "Failed to retrieve dispute from Stripe",
                        dispute_id=str(dispute.id),
                        error=str(e),
                    )
                    continue

                stripe_status = DisputeStatus.from_stripe(stripe_dispute.status)
                if stripe_status not in DisputeStatus.closed_statuses():
                    skipped_open += 1
                    rows.append((dispute, stripe_status.value, "skip — open at Stripe"))
                    continue

                remediated += 1
                rows.append((dispute, stripe_status.value, "→ prevented"))
                if not execute:
                    continue

                previous_status = dispute.status
                dispute.status = DisputeStatus.prevented
                await dispute_service._revoke(session, dispute)
                await repository.update(dispute)
                await dispute_service._sync_support_case(
                    session, dispute, previous_status=previous_status
                )

            _render(rows)

            if execute:
                await session.commit()
                log.info(
                    "Backfill complete",
                    remediated=remediated,
                    skipped_open=skipped_open,
                    errored=errored,
                )
            else:
                log.info(
                    "Dry-run only — re-run with --execute to apply",
                    would_remediate=remediated,
                    skip_open=skipped_open,
                    errored=errored,
                )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
