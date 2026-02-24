"""
Script to void orders that are eligible based on customer/subscription/organization status.

This script finds and voids orders that are:
- Linked to soft-deleted customers
- Linked to canceled subscriptions
- Linked to blocked organizations

The script runs in dry-run mode by default and requires explicit --commit flag to make changes.
"""

import asyncio
from collections import defaultdict
from collections.abc import Sequence
from functools import wraps

import typer
from rich import print
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from sqlalchemy import or_, select

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import (
    Customer,
    Order,
    Organization,
    Subscription,
)
from polar.models.subscription import SubscriptionStatus
from polar.order.service import OrderService
from polar.postgres import create_async_engine

cli = typer.Typer()


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def find_eligible_orders(
    session: AsyncSession, limit: int | None = None
) -> Sequence[Order]:
    """
    Find orders that are eligible for voiding based on:
    - Soft-deleted customers
    - Canceled subscriptions
    - Blocked organizations
    """
    print("[bold yellow]🔍 Finding eligible orders...[/bold yellow]")

    # Base query: only pending orders can be voided
    base_query = select(Order).where(Order.status == "pending")

    # Subquery 1: Orders linked to soft-deleted customers
    deleted_customers_subquery = (
        select(Order.id)
        .join(Customer, Order.customer_id == Customer.id)
        .where(Customer.is_deleted.is_(True))
    )

    # Subquery 2: Orders linked to canceled subscriptions
    canceled_subscriptions_subquery = (
        select(Order.id)
        .join(Subscription, Order.subscription_id == Subscription.id)
        .where(Subscription.status == SubscriptionStatus.canceled)
    )

    # Subquery 3: Orders linked to blocked organizations
    blocked_organizations_subquery = (
        select(Order.id)
        .join(Customer, Order.customer_id == Customer.id)
        .join(Organization, Customer.organization_id == Organization.id)
        .where(
            or_(Organization.blocked_at.is_not(None), Organization.is_deleted.is_(True))
        )
    )

    # Combine all conditions
    combined_query = base_query.where(
        or_(
            Order.id.in_(deleted_customers_subquery),
            Order.id.in_(canceled_subscriptions_subquery),
            Order.id.in_(blocked_organizations_subquery),
        )
    )

    # Add limit if specified
    if limit is not None:
        combined_query = combined_query.limit(limit)

    result = await session.execute(combined_query)
    orders = result.scalars().unique().all()

    print(f"[bold green]✓ Found {len(orders)} eligible orders[/bold green]")
    return orders


async def void_orders(
    session: AsyncSession,
    orders: Sequence[Order],
    order_service: OrderService,
    progress: Progress,
) -> dict[str, int]:
    """
    Void the eligible orders and return statistics.
    """
    stats: defaultdict[str, int] = defaultdict(int)

    task_id = progress.add_task("[bold cyan]Voiding orders...", total=len(orders))

    for order in orders:
        try:
            # Check if order is still pending (might have changed since query)
            if order.status != "pending":
                stats["skipped_wrong_status"] += 1
                progress.update(
                    task_id,
                    advance=1,
                    description="[bold yellow]Skipping non-pending orders...",
                )
                continue

            # Void the order
            await order_service.void(session, order)
            stats["successfully_voided"] += 1

            progress.update(
                task_id,
                advance=1,
                description=f"[bold green]Voided {stats['successfully_voided']}/{len(orders)} orders...",
            )

        except Exception as e:
            stats["errors"] += 1
            progress.update(
                task_id,
                advance=1,
                description=f"[bold red]Error: {e} (order {order.id})",
            )
            # Continue with next order instead of failing the whole batch
            continue

    progress.remove_task(task_id)
    return stats


def display_summary(stats: dict[str, int], total_orders: int) -> None:
    """
    Display a summary of the voiding operation using Rich table.
    """
    print("\n[bold magenta]=== 📊 Void Operation Summary ===[/bold magenta]")

    # Create a table for better visualization
    table = Table(show_header=True, header_style="bold blue")
    table.add_column("Metric", style="dim", width=30)
    table.add_column("Count", style="bold green")

    # Add rows for each statistic
    table.add_row("Total eligible orders found", str(total_orders))
    table.add_row("Successfully voided", str(stats.get("successfully_voided", 0)))
    table.add_row("Skipped (wrong status)", str(stats.get("skipped_wrong_status", 0)))
    table.add_row("Errors encountered", str(stats.get("errors", 0)))

    # Calculate success rate
    if total_orders > 0:
        success_rate = (stats.get("successfully_voided", 0) / total_orders) * 100
        table.add_row("Success rate", f"{success_rate:.1f}%")

    print(table)
    print("[bold magenta]=====================================[/bold magenta]\n")


@cli.command()
@typer_async
async def main(
    commit: bool = typer.Option(
        False, help="Actually void orders (dry-run by default)"
    ),
    limit: int = typer.Option(None, help="Limit number of orders to process"),
) -> None:
    """Main entry point for the void eligible orders script."""
    try:
        print("[bold green]Starting void eligible orders script[/bold green]")
        if not commit:
            print(
                "[bold blue]ℹ️  Running in DRY-RUN mode - no changes will be made[/bold blue]"
            )
        else:
            print(
                "[bold yellow]⚠️  Running in COMMIT mode - orders will be voided[/bold yellow]"
            )

        # Create database session
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as session:
            # Initialize services
            order_service = OrderService()

            # Find eligible orders
            eligible_orders = await find_eligible_orders(session, limit)

            if not eligible_orders:
                print(
                    "[bold blue]ℹ️  No eligible orders found - nothing to do[/bold blue]"
                )
                return

            # Process orders with progress bar
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                "•",
                "[progress.percentage]{task.percentage:>3.0f}%",
                "•",
                TextColumn("[progress.completed]{task.completed}/{task.total}"),
                transient=True,
            ) as progress:
                stats = await void_orders(
                    session, eligible_orders, order_service, progress
                )

            # Display summary
            display_summary(stats, len(eligible_orders))

            if commit:
                await session.commit()
                print(
                    "[bold green]✅ Changes have been committed to the database[/bold green]"
                )
            else:
                await session.rollback()
                print("[bold blue]ℹ️  Dry run - no changes have been saved[/bold blue]")

        print("[bold green]✅ Script completed successfully![/bold green]")

    except Exception as e:
        print(f"[bold red]❌ Script failed: {e}[/bold red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    cli()
