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
    .where(Organization.feature_settings.has_key("billing_enabled"))
    .order_by(Organization.id)
    .limit(limit_bindparam())
    .scalar_subquery()
)

update_statement = (
    update(Organization)
    .values(feature_settings=Organization.feature_settings.op("-")("billing_enabled"))
    .where(Organization.id.in_(subquery))
)


@cli.command()
@typer_async
async def remove_billing_enabled_feature_flag(
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
