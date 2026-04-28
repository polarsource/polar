import typer
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import array

from polar.models import Organization
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()


UNUSED_FLAGS = [
    "tinybird_read",
    "tinybird_compare",
    "presentment_currencies_enabled",
    "articles_enabled",
    "usage_based_billing_enabled",
    "subscriptions_enabled",
    "revops_enabled",
]


subquery = (
    select(Organization.id)
    .where(Organization.feature_settings.op("?|")(array(UNUSED_FLAGS)))
    .order_by(Organization.id)
    .limit(limit_bindparam())
    .scalar_subquery()
)

update_statement = (
    update(Organization)
    .values(
        feature_settings=Organization.feature_settings.op("-")("tinybird_read")
        .op("-")("tinybird_compare")
        .op("-")("presentment_currencies_enabled")
        .op("-")("articles_enabled")
        .op("-")("usage_based_billing_enabled")
        .op("-")("subscriptions_enabled")
        .op("-")("revops_enabled")
    )
    .where(Organization.id.in_(subquery))
)


@cli.command()
@typer_async
async def remove_unused_feature_flags(
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
