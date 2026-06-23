"""Upgrade individual customers who actually bought seats to 'team'.

A purchase with ``seats IS NOT NULL`` — a one-time order (``order/service.py``) or
a subscription (``subscription/service.py``) — means the customer really purchased
seats, which should make them a 'team' customer. The runtime hooks that perform
this upgrade were added after seat-based pricing shipped, so some existing buyers
are stranded as 'individual'. This backfill catches them up.

Limited to organizations that have migrated to the member model
(``feature_settings.member_model_enabled``); pre-migration organizations are skipped.

One-way and idempotent: only customers currently 'individual' (or NULL, treated as
individual) are touched, mirroring ``CustomerService.upgrade_to_team``.

Usage:
    cd server
    uv run python -m scripts.backfill_seat_customers_to_team
    uv run python -m scripts.backfill_seat_customers_to_team --no-dry-run
"""

import uuid

import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import Select, or_, select, update

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Order, Organization, Subscription
from polar.models.customer import CustomerType
from polar.postgres import create_async_engine
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()
console = Console()
configure_script_console_logging()


def _target_customer_ids() -> Select[tuple[uuid.UUID]]:
    seat_order_customers = select(Order.customer_id).where(
        Order.seats.is_not(None),
        Order.deleted_at.is_(None),
    )
    seat_subscription_customers = select(Subscription.customer_id).where(
        Subscription.seats.is_not(None),
        Subscription.deleted_at.is_(None),
    )
    # Only organizations that have migrated to the member model; an absent flag
    # evaluates to NULL and is excluded, skipping pre-migration organizations.
    member_model_organizations = select(Organization.id).where(
        Organization.feature_settings["member_model_enabled"].as_boolean().is_(True)
    )
    return select(Customer.id).where(
        Customer.deleted_at.is_(None),
        or_(
            Customer._type.is_(None),
            Customer._type == CustomerType.individual,
        ),
        Customer.organization_id.in_(member_model_organizations),
        or_(
            Customer.id.in_(seat_order_customers),
            Customer.id.in_(seat_subscription_customers),
        ),
    )


@cli.command()
@typer_async
async def backfill_seat_customers_to_team(
    dry_run: bool = typer.Option(
        True, help="Print what would be done without writing changes"
    ),
) -> None:
    mode = "DRY-RUN" if dry_run else "EXECUTE"
    console.rule(f"[bold]Upgrade seat customers to team — {mode}")

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            customers = (
                await session.execute(
                    select(Customer.id, Customer.email, Customer._type).where(
                        Customer.id.in_(_target_customer_ids())
                    )
                )
            ).all()

            verb = "Would upgrade" if dry_run else "Upgrading"
            console.print(f"{verb} [bold]{len(customers)}[/bold] customer(s) to 'team'")

            if customers:
                table = Table()
                table.add_column("Customer ID")
                table.add_column("Email")
                table.add_column("Current type")
                for customer_id, email, customer_type in customers:
                    table.add_row(
                        str(customer_id),
                        email or "—",
                        customer_type or "individual (NULL)",
                    )
                console.print(table)

            if customers and not dry_run:
                await session.execute(
                    update(Customer)
                    .values({Customer._type: CustomerType.team})
                    .where(Customer.id.in_([customer.id for customer in customers]))
                )
                await session.commit()
                console.print(
                    f"[green]✓ Upgraded {len(customers)} customer(s) to 'team'"
                )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
