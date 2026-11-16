"""
Backfill `subscription_renewal: false` into every member's notification settings.

Rows written before the setting existed lack the key, and
`OrganizationNotificationSettings` requires it since #13632. Rows that already
have the key are left untouched.

Usage:
    cd server
    uv run python -m scripts.backfill_subscription_renewal_setting
"""

import typer
from sqlalchemy import func, select, tuple_, update

from polar.models import UserOrganization
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
async def backfill(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        (
            update(UserOrganization)
            .values(
                notification_settings=UserOrganization.notification_settings.op("||")(
                    func.jsonb_build_object("subscription_renewal", False)
                ),
                # Self-assign to suppress the onupdate: a backfill must not make
                # every membership look freshly modified by its user.
                modified_at=UserOrganization.modified_at,
            )
            .where(
                tuple_(
                    UserOrganization.user_id,
                    UserOrganization.organization_id,
                ).in_(
                    select(
                        UserOrganization.user_id,
                        UserOrganization.organization_id,
                    )
                    .where(
                        UserOrganization.notification_settings.is_not(None),
                        ~UserOrganization.notification_settings.has_key(
                            "subscription_renewal"
                        ),
                    )
                    .order_by(
                        UserOrganization.user_id,
                        UserOrganization.organization_id,
                    )
                    .limit(limit_bindparam())
                )
            )
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
