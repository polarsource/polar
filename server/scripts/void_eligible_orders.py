"""
Script to void orders that are eligible based on customer/organization status.

This script finds and voids orders that are:
- Linked to soft-deleted customers
- Linked to blocked organizations

The script runs in dry-run mode by default and requires explicit --commit flag to make changes.
"""

import asyncio
import logging.config
from collections import defaultdict
from collections.abc import AsyncGenerator, AsyncIterator
from functools import wraps
from typing import Any

import dramatiq
import structlog
import typer
from rich import print
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from sqlalchemy import Select, func, or_, select

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import (
    Customer,
    Order,
    Organization,
)
from polar.order.repository import OrderRepository
from polar.order.service import OrderService
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker._enqueue import JobQueueManager

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


def get_query() -> Select[tuple[Order]]:
    """
    Build the base query for eligible orders that can be voided.

    Returns a tuple of (base_query, where_clause) that can be used for both
    count queries and streaming queries.
    """
    # Subquery 1: Orders linked to soft-deleted customers
    deleted_customers_subquery = (
        select(Order.id)
        .join(Customer, Order.customer_id == Customer.id)
        .where(Customer.is_deleted.is_(True))
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

    # Combine all conditions - this is the core eligibility logic
    eligibility_conditions = or_(
        Order.id.in_(deleted_customers_subquery),
        Order.id.in_(blocked_organizations_subquery),
    )

    return select(Order).where(Order.status == "pending").where(eligibility_conditions)


async def get_eligible_orders_count(session: AsyncSession) -> int:
    query = get_query().with_only_columns(func.count())
    result = await session.execute(query)
    return result.scalar_one()


def stream_eligible_orders(session: AsyncSession) -> AsyncGenerator[Order, None]:
    """
    Stream orders that are eligible for voiding (memory-efficient).
    """
    repository = OrderRepository.from_session(session)
    query = get_query().options(*repository.get_eager_options())
    return repository.stream(query)


async def void_orders(
    session: AsyncSession,
    order_stream: AsyncIterator[Order],
    order_service: OrderService,
    progress: Progress,
    total_count: int,
) -> dict[str, int]:
    """
    Void the eligible orders from stream and return statistics.
    """
    stats: defaultdict[str, int] = defaultdict(int)

    task_id = progress.add_task("[bold cyan]Voiding orders...", total=total_count)

    processed_count = 0
    async for order in order_stream:
        processed_count += 1
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
            description=f"[bold green]Voided {stats['successfully_voided']}/{processed_count} orders...",
        )

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
) -> None:
    """Main entry point for the void eligible orders script."""
    print("[bold green]Starting void eligible orders script[/bold green]")
    if not commit:
        print(
            "[bold blue]ℹ️  Running in DRY-RUN mode - no changes will be made[/bold blue]"
        )
    else:
        print(
            "[bold yellow]⚠️  Running in COMMIT mode - orders will be voided[/bold yellow]"
        )

    redis = create_redis("app")
    async with JobQueueManager.open(dramatiq.get_broker(), redis) as manager:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as session:
            # Initialize services
            order_service = OrderService()

            # Find eligible orders
            # Get count of eligible orders for progress bar
            total_count = await get_eligible_orders_count(session)

            if total_count == 0:
                print(
                    "[bold blue]ℹ️  No eligible orders found - nothing to do[/bold blue]"
                )
                return

            print(
                f"[bold yellow]🔍 Found {total_count} eligible orders to process[/bold yellow]"
            )

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                "•",
                "[progress.percentage]{task.percentage:>3.0f}%",
                "•",
                TextColumn("[progress.completed]{task.completed}/{task.total}"),
                transient=True,
            ) as progress:
                order_stream = stream_eligible_orders(session)
                stats = await void_orders(
                    session, order_stream, order_service, progress, total_count
                )

            # Display summary
            display_summary(stats, total_count)

            if commit:
                await session.commit()
                await manager.flush(dramatiq.get_broker(), redis)
                print(
                    "[bold green]✅ Changes have been committed to the database[/bold green]"
                )
            else:
                await session.rollback()
                manager.reset()
                print("[bold blue]ℹ️  Dry run - no changes have been saved[/bold blue]")

    print("[bold green]✅ Script completed successfully![/bold green]")


if __name__ == "__main__":
    cli()
