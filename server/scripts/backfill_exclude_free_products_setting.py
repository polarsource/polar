"""
Backfill `exclude_free_products: false` into every member's notification settings.

Rows written before the setting existed lack the key. Once this has run, the key
can become required on `OrganizationNotificationSettings`.

Usage:
    cd server
    uv run python -m scripts.backfill_exclude_free_products_setting
"""

import typer
from sqlalchemy import Update, func, select, tuple_, update

from polar.models import UserOrganization
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()


def backfill_statement() -> Update:
    return (
        update(UserOrganization)
        .values(
            notification_settings=UserOrganization.notification_settings.op("||")(
                func.jsonb_build_object("exclude_free_products", False)
            )
        )
        .where(
            tuple_(UserOrganization.user_id, UserOrganization.organization_id).in_(
                select(UserOrganization.user_id, UserOrganization.organization_id)
                .where(
                    ~UserOrganization.notification_settings.has_key(
                        "exclude_free_products"
                    )
                )
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
