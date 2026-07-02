import typer
from sqlalchemy import String, select, update

from polar.models import BenefitGrant, LicenseKey, Subscription
from polar.models.subscription import SubscriptionStatus
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
async def unset_subscription_license_key_expiration(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Unset `expires_at` on license keys granted through an active subscription.

    License keys backed by a subscription stay valid as long as the subscription
    is active, so they should never carry an expiration date. This backfills
    existing keys that were granted with a TTL before that rule was introduced.

    "Active" here means billable — active, trialing, or past due (still in the
    grace period) — matching `SubscriptionStatus.billable_statuses()`.
    """
    subscription_license_key_ids = (
        select(LicenseKey.id)
        .join(
            BenefitGrant,
            LicenseKey.id.cast(String)
            == BenefitGrant.properties["license_key_id"].as_string(),
        )
        .join(Subscription, Subscription.id == BenefitGrant.subscription_id)
        .where(
            LicenseKey.expires_at.is_not(None),
            LicenseKey.deleted_at.is_(None),
            BenefitGrant.is_deleted.is_(False),
            Subscription.status.in_(SubscriptionStatus.billable_statuses()),
        )
        .order_by(LicenseKey.id)
        .limit(limit_bindparam())
    )

    await run_batched_update(
        (
            update(LicenseKey)
            .values(expires_at=None)
            .where(LicenseKey.id.in_(subscription_license_key_ids))
        ),
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


if __name__ == "__main__":
    cli()
