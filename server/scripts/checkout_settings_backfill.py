import typer
from sqlalchemy import select, update

from polar.models import Organization
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()

subquery = (
    select(Organization.id)
    .where(
        Organization._checkout_settings.is_(None),
    )
    .order_by(Organization.id)
    .limit(limit_bindparam())
    .scalar_subquery()
)

update_statement = (
    update(Organization)
    .values(_checkout_settings={"require_3ds": False})
    .where(Organization.id.in_(subquery))
)


@cli.command()
@typer_async
async def checkout_settings_backfill(
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
