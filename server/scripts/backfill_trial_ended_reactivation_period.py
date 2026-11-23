"""
Backfill `trial_ended_reactivation_period` into every organization's subscription
settings.

Rows written before this setting existed lack the key and read as the 14-day
default. Keys already present are left untouched. Once this has run, the key can
become required on `OrganizationSubscriptionSettings`.

Usage:
    cd server
    uv run python -m scripts.backfill_trial_ended_reactivation_period
"""

import typer
from sqlalchemy import Update, func, select, update

from polar.models import Organization
from polar.models.organization import DEFAULT_TRIAL_ENDED_REACTIVATION_PERIOD
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()


def backfill_statement() -> Update:
    settings = Organization.subscription_settings
    defaults = func.jsonb_build_object(
        "trial_ended_reactivation_period", DEFAULT_TRIAL_ENDED_REACTIVATION_PERIOD
    )
    return (
        update(Organization)
        .values(
            subscription_settings=defaults.op("||")(settings),
            # Self-assign to suppress the onupdate: a backfill must not make
            # every organization look freshly modified.
            modified_at=Organization.modified_at,
        )
        .where(
            Organization.id.in_(
                select(Organization.id)
                .where(~settings.has_key("trial_ended_reactivation_period"))
                .limit(limit_bindparam())
            )
        )
    )


@cli.command()
@typer_async
async def backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        backfill_statement(), batch_size=batch_size, sleep_seconds=sleep_seconds
    )


if __name__ == "__main__":
    cli()
