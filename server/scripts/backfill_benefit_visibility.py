"""Backfill the visibility column for existing benefits.

All existing benefits are set to public so nothing is unexpectedly hidden in
the customer portal. New benefits created after this backfill get their
visibility from `BenefitType.resolve_visibility()` in `BenefitService.user_create`
(e.g. feature flags defaulting to private once that rollout is enabled).

The update is idempotent: once a row has visibility set it no longer matches
the filter, so the script can be safely re-run or resumed.
"""

import typer
from sqlalchemy import select, update

from polar.kit.visibility import Visibility
from polar.models import Benefit
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()

subquery = (
    select(Benefit.id)
    .where(Benefit.visibility.is_(None))
    .order_by(Benefit.id)
    .limit(limit_bindparam())
    .scalar_subquery()
)

update_statement = (
    update(Benefit).values(visibility=Visibility.public).where(Benefit.id.in_(subquery))
)


@cli.command()
@typer_async
async def backfill_benefit_visibility(
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
