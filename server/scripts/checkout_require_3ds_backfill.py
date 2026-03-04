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


@cli.command()
@typer_async
async def checkout_require_3ds_backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
    threshold: int = typer.Option(25000, help="Threshold in cents (default $250)"),
) -> None:
    """
    Enable require_3ds for organizations with next_review_threshold below
    the specified amount.
    """
    subquery = (
        select(Organization.id)
        .where(
            Organization.next_review_threshold < threshold,
            Organization.checkout_settings["require_3ds"].astext == "false",
        )
        .order_by(Organization.id)
        .limit(limit_bindparam())
        .scalar_subquery()
    )

    update_statement = (
        update(Organization)
        .values(
            checkout_settings=Organization.checkout_settings.concat(
                {"require_3ds": True}
            )
        )
        .where(Organization.id.in_(subquery))
    )

    await run_batched_update(
        update_statement,
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
