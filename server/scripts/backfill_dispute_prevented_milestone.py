"""
Backfill the ``dispute_prevented`` milestone onto dispute support cases that were
silently closed before that lifecycle event existed.

Prevented disputes (chargebacks refunded before they went through) used to close
the case with a bare ``closed`` event — no record of *why*. Going forward the
sync posts a ``dispute_prevented`` milestone; this adds it to the existing stock.

A case qualifies when:
  - it's a dispute case (``type = dispute``) whose dispute is ``prevented``,
  - it has a ``closed`` event (it was actually closed), and
  - it has no ``dispute_prevented`` message yet (so this is re-runnable).

The milestone is inserted just before the ``closed`` event (system-authored,
merchant audience, no body — same as the live path).

Usage:
    cd server

    # Dry-run (default) — list the cases that would get the milestone:
    uv run python -m scripts.backfill_dispute_prevented_milestone

    # Apply:
    uv run python -m scripts.backfill_dispute_prevented_milestone --execute
"""

from collections.abc import Sequence
from datetime import timedelta
from typing import Any

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import Select, func, select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Dispute, Order, Organization
from polar.models.dispute import DisputeStatus
from polar.models.support_case import (
    DisputeSupportCase,
    SupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseType,
)
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
configure_script_console_logging()
log = structlog.get_logger()


def _statement() -> Select[Any]:
    closed_at = (
        select(func.max(SupportCaseMessage.created_at))
        .where(
            SupportCaseMessage.case_id == SupportCase.id,
            SupportCaseMessage.type == SupportCaseMessageType.closed,
            SupportCaseMessage.deleted_at.is_(None),
        )
        .scalar_subquery()
    )
    has_prevented = (
        select(SupportCaseMessage.id)
        .where(
            SupportCaseMessage.case_id == SupportCase.id,
            SupportCaseMessage.type == SupportCaseMessageType.dispute_prevented,
        )
        .exists()
    )
    return (
        select(
            SupportCase.id.label("case_id"),
            Organization.slug.label("org"),
            closed_at.label("closed_at"),
        )
        .join(Dispute, DisputeSupportCase.dispute_id == Dispute.id)
        .join(Order, Dispute.order_id == Order.id)
        .join(Organization, Order.organization_id == Organization.id)
        .where(
            SupportCase.type == SupportCaseType.dispute,
            SupportCase.deleted_at.is_(None),
            Dispute.status == DisputeStatus.prevented,
            closed_at.is_not(None),
            ~has_prevented,
        )
        .order_by(closed_at)
    )


def _render(rows: Sequence[Any]) -> None:
    table = Table(title=f"Prevented cases missing the milestone ({len(rows)})")
    table.add_column("Case ID", style="dim")
    table.add_column("Organization")
    table.add_column("Closed at", style="yellow")
    for row in rows:
        table.add_row(str(row.case_id), row.org, str(row.closed_at))
    console.print(table)


@cli.command()
@typer_async
async def backfill_dispute_prevented_milestone(
    execute: bool = typer.Option(
        False, help="Actually insert the milestones (default: dry-run)"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    mode = "EXECUTE" if execute else "DRY-RUN"
    console.rule(f"[bold]Backfill dispute_prevented milestone — {mode}")

    try:
        async with sessionmaker() as session:
            rows = (await session.execute(_statement())).all()
            _render(rows)

            if not rows:
                log.info("Nothing to do — every prevented case has the milestone")
                return
            if not execute:
                log.info(
                    "Dry-run only — re-run with --execute to insert", total=len(rows)
                )
                return

            for row in rows:
                session.add(
                    SupportCaseMessage(
                        case_id=row.case_id,
                        type=SupportCaseMessageType.dispute_prevented,
                        author_kind=SupportCaseMessageAuthorKind.system,
                        audience=[SupportCaseAudience.merchant],
                        # Sit just before the close so the timeline reads in order.
                        created_at=row.closed_at - timedelta(microseconds=1),
                    )
                )
            await session.commit()
            log.info("Backfilled dispute_prevented milestones", total=len(rows))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
