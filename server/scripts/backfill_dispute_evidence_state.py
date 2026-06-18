"""Backfill the evidence submission-state columns for existing disputes.

`has_evidence`, `past_due` and `submission_count` were added as nullable. Rows
created before the dispute webhook captured them are NULL; set them to their
"no evidence submitted yet" defaults so a follow-up migration can make the
columns non-nullable.

The update is idempotent: once a row has `has_evidence` set it no longer matches
the filter, so the script can be safely re-run or resumed.
"""

import typer
from sqlalchemy import select, update

from polar.models import Dispute
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()

subquery = (
    select(Dispute.id)
    .where(Dispute.has_evidence.is_(None))
    .order_by(Dispute.id)
    .limit(limit_bindparam())
    .scalar_subquery()
)

update_statement = (
    update(Dispute)
    .values(has_evidence=False, past_due=False, submission_count=0)
    .where(Dispute.id.in_(subquery))
)


@cli.command()
@typer_async
async def backfill_dispute_evidence_state(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        update_statement,
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
