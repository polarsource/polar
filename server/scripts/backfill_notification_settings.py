"""
Backfill `exclude_free_products`, `new_trial` and `subscription_cancellation` into
every member's notification settings.

Rows written before these settings existed lack the keys. `exclude_free_products`
and `subscription_cancellation` default to false, while `new_trial` takes the
member's `new_subscription` value. Keys already present are left untouched. Once
this has run, these keys can become required on `OrganizationNotificationSettings`.

Usage:
    cd server
    uv run python -m scripts.backfill_notification_settings
"""

import typer
from sqlalchemy import Update, func, literal, or_, select, tuple_, update
from sqlalchemy.dialects.postgresql import JSONB

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
    settings = UserOrganization.notification_settings
    defaults = func.jsonb_build_object(
        "exclude_free_products",
        False,
        "new_trial",
        func.coalesce(settings["new_subscription"], literal(True, JSONB)),
        "subscription_cancellation",
        False,
    )
    return (
        update(UserOrganization)
        .values(
            notification_settings=defaults.op("||")(settings),
            # Self-assign to suppress the onupdate: a backfill must not make
            # every membership look freshly modified by its user.
            modified_at=UserOrganization.modified_at,
        )
        .where(
            tuple_(UserOrganization.user_id, UserOrganization.organization_id).in_(
                select(UserOrganization.user_id, UserOrganization.organization_id)
                .where(
                    or_(
                        ~settings.has_key("exclude_free_products"),
                        ~settings.has_key("new_trial"),
                        ~settings.has_key("subscription_cancellation"),
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
