import uuid

import typer
from sqlalchemy import Select, Update, exists, func, literal, select, update
from sqlalchemy.dialects.postgresql import JSONB

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import (
    Organization,
    ProductPrice,
    Subscription,
    SubscriptionProductPrice,
)
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()

FLAG = "reducer_billing_enabled"


def candidates_statement() -> Select[uuid.UUID]:
    # Select organizations with uncanceled / ongoing metered subscriptions
    # this will be used as an anti-filter, so that we can enable
    # the feature flag for all orgs that _do not_ meet these requirements
    has_metered_subscription = exists(
        select(SubscriptionProductPrice.id)
        .join(Subscription, Subscription.id == SubscriptionProductPrice.subscription_id)
        .join(
            ProductPrice, ProductPrice.id == SubscriptionProductPrice.product_price_id
        )
        .where(
            Subscription.organization_id == Organization.id,
            Subscription.ended_at.is_(None),
            ~SubscriptionProductPrice.is_deleted,
            ProductPrice.is_metered,
        )
    )
    return select(Organization.id).where(
        Organization.feature_settings[FLAG].as_boolean().is_not(True),
        ~has_metered_subscription,
    )


def enable_statement() -> Update:
    return (
        update(Organization)
        .values(
            feature_settings=Organization.feature_settings.op("||", return_type=JSONB)(
                func.jsonb_build_object(FLAG, literal(True))
            )
        )
        .where(
            Organization.id.in_(candidates_statement().limit(limit_bindparam())),
        )
    )


async def count_candidates(session: AsyncSession) -> int:
    statement = candidates_statement().with_only_columns(func.count(Organization.id))
    return (await session.execute(statement)).scalar_one()


@cli.command()
@typer_async
async def enable_reducer_billing_flag(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
    execute: bool = typer.Option(False, help="Apply the changes; dry-run otherwise"),
) -> None:
    if not execute:
        engine = create_async_engine("script")
        try:
            async with create_async_sessionmaker(engine)() as session:
                count = await count_candidates(session)
        finally:
            await engine.dispose()
        typer.echo(
            f"Dry run: {count} organizations would get {FLAG}. Pass --execute to apply."
        )
        return

    await run_batched_update(
        enable_statement(), batch_size=batch_size, sleep_seconds=sleep_seconds
    )


if __name__ == "__main__":
    cli()
