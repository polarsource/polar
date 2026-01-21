"""
Billing Oracle CLI.

Commands for running billing reconciliation:
- reconcile-order: Reconcile a single order
- reconcile-subscription: Reconcile all orders for a subscription
- sweep: Run nightly sweep reconciliation

Usage:
    python -m scripts.billing_oracle reconcile-order <order_id>
    python -m scripts.billing_oracle reconcile-subscription <subscription_id>
    python -m scripts.billing_oracle sweep --hours 24 --limit 1000
"""

import asyncio
from datetime import datetime
from uuid import UUID

import typer
from rich.console import Console
from rich.table import Table

from polar.billing_oracle.reporter import format_mismatch_summary
from polar.billing_oracle.service import billing_oracle_service
from polar.postgres import create_async_engine

from .helper import typer_async

cli = typer.Typer()
console = Console()


async def get_session():
    """Create a database session."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    engine = create_async_engine("billing_oracle")
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return async_session()


@cli.command()
@typer_async
async def reconcile_order(
    order_id: str = typer.Argument(..., help="UUID of the order to reconcile"),
    quiet: bool = typer.Option(False, "--quiet", "-q", help="Only output summary"),
) -> None:
    """
    Reconcile a single order against the Billing Oracle.

    Simulates expected billing artifacts and compares against actual order.
    """
    try:
        order_uuid = UUID(order_id)
    except ValueError:
        console.print(f"[red]Invalid order ID: {order_id}[/red]")
        raise typer.Exit(1)

    console.print(f"[blue]Reconciling order {order_id}...[/blue]")

    async with await get_session() as session:
        result = await billing_oracle_service.reconcile_order(
            session, order_uuid, report=not quiet
        )

    if quiet:
        if result.has_errors:
            console.print(f"[red]ERRORS: {result.error_count + result.critical_count}[/red]")
            raise typer.Exit(1)
        else:
            console.print("[green]OK[/green]")
    else:
        console.print("\n" + format_mismatch_summary(result))

        if result.has_critical_mismatches:
            console.print("\n[red bold]CRITICAL MISMATCHES DETECTED[/red bold]")
            raise typer.Exit(2)
        elif result.has_errors:
            console.print("\n[red]ERRORS DETECTED[/red]")
            raise typer.Exit(1)
        else:
            console.print("\n[green]Reconciliation complete - no significant issues[/green]")


@cli.command()
@typer_async
async def reconcile_subscription(
    subscription_id: str = typer.Argument(..., help="UUID of the subscription to reconcile"),
    period_start: str = typer.Option(None, help="Start of period (ISO format)"),
    period_end: str = typer.Option(None, help="End of period (ISO format)"),
    quiet: bool = typer.Option(False, "--quiet", "-q", help="Only output summary"),
) -> None:
    """
    Reconcile all orders for a subscription.

    Optionally filter to a specific period.
    """
    try:
        sub_uuid = UUID(subscription_id)
    except ValueError:
        console.print(f"[red]Invalid subscription ID: {subscription_id}[/red]")
        raise typer.Exit(1)

    period_start_dt = None
    period_end_dt = None

    if period_start:
        try:
            period_start_dt = datetime.fromisoformat(period_start)
        except ValueError:
            console.print(f"[red]Invalid period_start format: {period_start}[/red]")
            raise typer.Exit(1)

    if period_end:
        try:
            period_end_dt = datetime.fromisoformat(period_end)
        except ValueError:
            console.print(f"[red]Invalid period_end format: {period_end}[/red]")
            raise typer.Exit(1)

    console.print(f"[blue]Reconciling subscription {subscription_id}...[/blue]")

    async with await get_session() as session:
        result = await billing_oracle_service.reconcile_subscription(
            session, sub_uuid, period_start_dt, period_end_dt, report=not quiet
        )

    if quiet:
        console.print(f"Orders: {result.orders_checked}, Mismatches: {len(result.mismatches)}")
        if result.has_errors:
            raise typer.Exit(1)
    else:
        console.print("\n" + format_mismatch_summary(result))

        if result.has_critical_mismatches:
            console.print("\n[red bold]CRITICAL MISMATCHES DETECTED[/red bold]")
            raise typer.Exit(2)
        elif result.has_errors:
            console.print("\n[red]ERRORS DETECTED[/red]")
            raise typer.Exit(1)
        else:
            console.print("\n[green]Reconciliation complete[/green]")


@cli.command()
@typer_async
async def sweep(
    hours: int = typer.Option(24, "--hours", "-h", help="Hours to look back"),
    limit: int = typer.Option(1000, "--limit", "-l", help="Maximum orders to check"),
    quiet: bool = typer.Option(False, "--quiet", "-q", help="Only output summary"),
) -> None:
    """
    Run sweep reconciliation on recent orders.

    This is the "nightly sweep" mode that reconciles all subscription orders
    created in the last N hours.
    """
    console.print(f"[blue]Running sweep reconciliation (last {hours} hours, limit {limit})...[/blue]")

    async with await get_session() as session:
        result = await billing_oracle_service.run_sweep(
            session, hours, limit, report=not quiet
        )

    if quiet:
        console.print(f"Orders: {result.orders_checked}, Mismatches: {len(result.mismatches)}")
        if result.has_errors:
            raise typer.Exit(1)
    else:
        console.print("\n" + format_mismatch_summary(result))

        # Print summary table
        table = Table(title="Sweep Summary")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="magenta")

        table.add_row("Run ID", result.run_id)
        table.add_row("Orders Checked", str(result.orders_checked))
        table.add_row("Line Items Checked", str(result.line_items_checked))
        table.add_row("Total Mismatches", str(len(result.mismatches)))
        table.add_row("Critical", str(result.critical_count))
        table.add_row("Errors", str(result.error_count))
        table.add_row("Warnings", str(result.warning_count))
        table.add_row("Info", str(result.info_count))

        console.print(table)

        if result.has_critical_mismatches:
            console.print("\n[red bold]CRITICAL MISMATCHES DETECTED[/red bold]")
            raise typer.Exit(2)
        elif result.has_errors:
            console.print("\n[red]ERRORS DETECTED[/red]")
            raise typer.Exit(1)
        else:
            console.print("\n[green]Sweep complete - no significant issues[/green]")


@cli.command()
@typer_async
async def validate_invariants() -> None:
    """
    Run Oracle invariant validation on active subscriptions.

    This checks that the Oracle's internal logic is consistent.
    """
    from polar.billing_oracle.oracle import BillingOracle
    from polar.billing_oracle.repository import BillingOracleRepository

    console.print("[blue]Validating Oracle invariants on active subscriptions...[/blue]")

    oracle = BillingOracle()
    checked = 0
    violations = []

    async with await get_session() as session:
        repository = BillingOracleRepository(session)
        subscriptions = await repository.get_active_subscriptions(limit=100)

        for subscription in subscriptions:
            checked += 1

            # Get pending billing entries
            entries = await repository.get_pending_billing_entries(subscription.id)

            # Simulate expected order
            expected = oracle.simulate_subscription_cycle_order(
                subscription=subscription,
                billing_entries=entries,
                billing_reason="subscription_cycle",
            )

            # Check invariants
            if not oracle.check_conservation_invariant(expected):
                violations.append(f"Conservation violated for subscription {subscription.id}")

            if not oracle.check_non_negative_invariant(expected):
                violations.append(f"Non-negative violated for subscription {subscription.id}")

            if not oracle.check_balance_application_invariant(expected):
                violations.append(f"Balance application violated for subscription {subscription.id}")

    console.print(f"\nChecked {checked} subscriptions")

    if violations:
        console.print(f"\n[red]Found {len(violations)} invariant violations:[/red]")
        for v in violations:
            console.print(f"  - {v}")
        raise typer.Exit(1)
    else:
        console.print("[green]All invariants passed![/green]")


if __name__ == "__main__":
    cli()
