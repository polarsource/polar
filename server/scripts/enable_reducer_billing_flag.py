import typer
from sqlalchemy import Update, exists, func, literal, select, update
from sqlalchemy.dialects.postgresql import JSONB

from polar.models import (
    Organization,
    ProductPrice,
    Subscription,
    SubscriptionProductPrice,
)
from scripts.helper import (
    configure_script_logging,
    limit_bindparam,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()

configure_script_logging()

FLAG = "reducer_billing_enabled"


def enable_statement() -> Update:
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
    return (
        update(Organization)
        .values(
            feature_settings=Organization.feature_settings.op("||", return_type=JSONB)(
                func.jsonb_build_object(FLAG, literal(True))
            )
        )
        .where(
            Organization.id.in_(
                select(Organization.id)
                .where(
                    Organization.feature_settings[FLAG].as_boolean().is_not(True),
                    ~has_metered_subscription,
                )
                .limit(limit_bindparam())
            ),
        )
    )


@cli.command()
@typer_async
async def enable_reducer_billing_flag(
    batch_size: int = typer.Option(5000, help="Number of rows to process per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    await run_batched_update(
        enable_statement(), batch_size=batch_size, sleep_seconds=sleep_seconds
    )


if __name__ == "__main__":
    cli()
