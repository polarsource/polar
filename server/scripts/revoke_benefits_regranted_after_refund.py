"""
Revoke benefit grants that are active on orders whose benefits were revoked by a
refund or a closed dispute.

Updating a product's benefits used to enqueue grants for every one-time order of
that product, including those orders. This finds active, non-manual grants on
such orders and enqueues the same `benefit.revoke` job a refund would.

Dry-run by default; pass --execute to enqueue the revocations.
"""

import asyncio
import logging.config
import uuid
from functools import wraps
from typing import Any

import dramatiq
import structlog
import typer
from rich import print
from rich.table import Table
from sqlalchemy import Select, select

from polar import tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import BenefitGrant, Order, Organization
from polar.order.repository import order_benefits_revoked_clause
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager, enqueue_job, make_bulk_job_delay_calculator

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig({"version": 1, "disable_existing_loggers": True})


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


GrantRow = Select[
    uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID | None, uuid.UUID | None, uuid.UUID, str
]


def get_statement(organization_id: uuid.UUID | None) -> GrantRow:
    statement = (
        select(
            BenefitGrant.id,
            BenefitGrant.customer_id,
            BenefitGrant.benefit_id,
            BenefitGrant.member_id,
            BenefitGrant.order_id,
            Organization.id.label("organization_id"),
            Organization.slug.label("organization_slug"),
        )
        .join(Order, Order.id == BenefitGrant.order_id)
        .join(Organization, Organization.id == Order.organization_id)
        .where(
            BenefitGrant.deleted_at.is_(None),
            BenefitGrant.granted_at.is_not(None),
            BenefitGrant.revoked_at.is_(None),
            BenefitGrant.manually_granted_at.is_(None),
            order_benefits_revoked_clause(Order.id),
            Order.subscription_id.is_(None),
            Order.seats.is_(None),
        )
        .order_by(Organization.slug, BenefitGrant.created_at)
    )
    if organization_id is not None:
        statement = statement.where(Organization.id == organization_id)
    return statement


@cli.command()
@typer_async
async def main(
    execute: bool = typer.Option(
        False, help="Enqueue revocations (dry-run by default)"
    ),
    organization_id: uuid.UUID | None = typer.Option(
        None, help="Only process grants of this organization"
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    async with sessionmaker() as session:
        result = await session.execute(get_statement(organization_id))
        grants = result.all()

    if not grants:
        print("[bold blue]No affected grants found[/bold blue]")
        return

    per_organization: dict[str, tuple[set[uuid.UUID], int]] = {}
    for grant in grants:
        key = f"{grant.organization_slug} ({grant.organization_id})"
        customers, count = per_organization.get(key, (set(), 0))
        customers.add(grant.customer_id)
        per_organization[key] = (customers, count + 1)

    table = Table("Organization", "Customers", "Grants")
    for key, (customers, count) in per_organization.items():
        table.add_row(key, str(len(customers)), str(count))
    print(table)
    print(
        f"[bold yellow]{len(grants)} grants across {len(per_organization)} "
        "organizations[/bold yellow]"
    )

    if not execute:
        print("[bold blue]Dry run: nothing enqueued[/bold blue]")
        return

    redis = create_redis("app")
    async with JobQueueManager.open(dramatiq.get_broker(), redis):
        calculate_delay = make_bulk_job_delay_calculator(len(grants))
        for index, grant in enumerate(grants):
            enqueue_job(
                "benefit.revoke",
                customer_id=grant.customer_id,
                benefit_id=grant.benefit_id,
                member_id=grant.member_id,
                order_id=grant.order_id,
                delay=calculate_delay(index),
            )

    print(f"[bold green]Enqueued {len(grants)} revocations[/bold green]")


if __name__ == "__main__":
    cli()
