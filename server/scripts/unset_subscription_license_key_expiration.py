import asyncio

import typer
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from sqlalchemy import Uuid, select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import BenefitGrant, LicenseKey, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.postgres import create_async_engine
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()


@cli.command()
@typer_async
async def unset_subscription_license_key_expiration(
    batch_size: int = typer.Option(5000, help="Number of rows to update per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    """Unset `expires_at` on license keys granted through an active subscription.

    License keys backed by a subscription stay valid as long as the subscription
    is active, so they should never carry an expiration date. This backfills
    existing keys that were granted with a TTL before that rule was introduced.

    "Active" here means billable — active, trialing, or past due (still in the
    grace period) — matching `SubscriptionStatus.billable_statuses()`.
    """
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            result = await session.execute(
                select(LicenseKey.id)
                .join(
                    BenefitGrant,
                    BenefitGrant.properties["license_key_id"].as_string().cast(Uuid)
                    == LicenseKey.id,
                )
                .join(Subscription, Subscription.id == BenefitGrant.subscription_id)
                .where(
                    LicenseKey.expires_at.is_not(None),
                    LicenseKey.deleted_at.is_(None),
                    BenefitGrant.is_deleted.is_(False),
                    Subscription.status.in_(SubscriptionStatus.billable_statuses()),
                )
            )
            license_key_ids = result.scalars().all()

        total = len(license_key_ids)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            transient=False,
        ) as progress:
            task = progress.add_task(
                f"[cyan]0/{total} license keys updated", total=total
            )

            for start in range(0, total, batch_size):
                chunk = license_key_ids[start : start + batch_size]
                async with sessionmaker() as session:
                    await session.execute(
                        update(LicenseKey)
                        .where(LicenseKey.id.in_(chunk))
                        .values(expires_at=None)
                    )
                    await session.commit()

                updated = min(start + batch_size, total)
                progress.update(
                    task,
                    completed=updated,
                    description=f"[cyan]{updated}/{total} license keys updated",
                )

                if sleep_seconds > 0 and updated < total:
                    await asyncio.sleep(sleep_seconds)

            progress.update(
                task,
                description=f"[green]✓ Complete: {total} license keys updated",
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
