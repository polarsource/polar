"""Run after deploying the nullable columns and before the NOT NULL migration.

uv run python -m scripts.backfill_organization_catalog_limits
"""

import typer
from sqlalchemy import func, or_, select, update

from polar.config import settings
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
async def backfill(
    batch_size: int = typer.Option(5000, min=1),
    sleep_seconds: float = typer.Option(0.1, min=0),
) -> None:
    missing_limits = or_(
        Organization.products_limit.is_(None), Organization.benefits_limit.is_(None)
    )
    statement = (
        update(Organization)
        .where(
            Organization.id.in_(
                select(Organization.id)
                .where(missing_limits)
                .order_by(Organization.id)
                .limit(limit_bindparam())
            ),
            missing_limits,
        )
        .values(
            products_limit=func.coalesce(
                Organization.products_limit,
                settings.ORGANIZATION_DEFAULT_PRODUCTS_LIMIT,
            ),
            benefits_limit=func.coalesce(
                Organization.benefits_limit,
                settings.ORGANIZATION_DEFAULT_BENEFITS_LIMIT,
            ),
            modified_at=Organization.modified_at,
        )
    )
    await run_batched_update(
        statement, batch_size=batch_size, sleep_seconds=sleep_seconds
    )


if __name__ == "__main__":
    cli()
