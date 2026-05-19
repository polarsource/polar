import asyncio
import uuid
from typing import Any

import typer
from rich.progress import Progress
from sqlalchemy import delete, or_, select

from polar.config import settings
from polar.integrations.tinybird.client import client as tinybird_client
from polar.integrations.tinybird.service import DATASOURCE_EVENTS
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Event, Order, Subscription
from polar.models.event import EventSource
from polar.postgres import create_async_engine

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

BATCH_SIZE = 100
TINYBIRD_DELETE_BATCH = 500


async def _list_free_subscription_ids(
    session: AsyncSession, *, product_id: uuid.UUID
) -> list[uuid.UUID]:
    statement = (
        select(Subscription.id)
        .where(
            Subscription.product_id == product_id,
            Subscription.deleted_at.is_(None),
        )
        .order_by(Subscription.created_at)
    )
    result = await session.execute(statement)
    return [row[0] for row in result.all()]


async def _list_zero_order_ids(
    session: AsyncSession,
    *,
    organization_id: uuid.UUID,
    subscription_ids: list[uuid.UUID],
) -> list[uuid.UUID]:
    if not subscription_ids:
        return []
    statement = (
        select(Order.id)
        .where(
            Order.organization_id == organization_id,
            Order.subscription_id.in_(subscription_ids),
            Order.deleted_at.is_(None),
            (Order.net_amount + Order.tax_amount) == 0,
        )
        .order_by(Order.created_at)
    )
    result = await session.execute(statement)
    return [row[0] for row in result.all()]


async def _list_event_ids(
    session: AsyncSession,
    *,
    organization_id: uuid.UUID,
    subscription_ids: list[uuid.UUID],
    order_ids: list[uuid.UUID],
) -> list[uuid.UUID]:
    if not subscription_ids and not order_ids:
        return []
    sub_id_strs = [str(s) for s in subscription_ids]
    order_id_strs = [str(o) for o in order_ids]
    clauses = []
    if sub_id_strs:
        clauses.append(
            Event.user_metadata["subscription_id"].as_string().in_(sub_id_strs)
        )
    if order_id_strs:
        clauses.append(Event.user_metadata["order_id"].as_string().in_(order_id_strs))
    statement = select(Event.id).where(
        Event.organization_id == organization_id,
        Event.source == EventSource.system,
        or_(*clauses),
    )
    result = await session.execute(statement)
    return [row[0] for row in result.all()]


async def _delete_zero_orders(
    session: AsyncSession,
    *,
    organization_id: uuid.UUID,
    subscription_ids: list[uuid.UUID],
) -> int:
    statement = delete(Order).where(
        Order.organization_id == organization_id,
        Order.subscription_id.in_(subscription_ids),
        (Order.net_amount + Order.tax_amount) == 0,
    )
    result = await session.execute(statement)
    return max(getattr(result, "rowcount", 0) or 0, 0)


async def _delete_subscriptions(
    session: AsyncSession,
    subscription_ids: list[uuid.UUID],
) -> int:
    statement = delete(Subscription).where(Subscription.id.in_(subscription_ids))
    result = await session.execute(statement)
    return max(getattr(result, "rowcount", 0) or 0, 0)


async def _delete_events(session: AsyncSession, event_ids: list[uuid.UUID]) -> int:
    if not event_ids:
        return 0
    result = await session.execute(delete(Event).where(Event.id.in_(event_ids)))
    return max(getattr(result, "rowcount", 0) or 0, 0)


async def _await_tinybird_job(result: dict[str, Any]) -> int:
    job_id = result.get("job_id")
    if job_id is None:
        return int(result.get("rows_affected", 0))
    while True:
        job = await tinybird_client.get_job(str(job_id))
        status = job.get("status")
        if status in {"done", "error"}:
            if status == "error":
                typer.echo(
                    f"Tinybird delete error: {job.get('error', 'unknown')}",
                    err=True,
                )
            return int(job.get("rows_affected", 0))
        await asyncio.sleep(0.25)


async def _delete_events_tinybird(event_ids: list[uuid.UUID]) -> int:
    if not event_ids:
        return 0
    total = 0
    with Progress() as progress:
        task = progress.add_task(
            "[cyan]Deleting events from Tinybird...", total=len(event_ids)
        )
        for start in range(0, len(event_ids), TINYBIRD_DELETE_BATCH):
            batch = event_ids[start : start + TINYBIRD_DELETE_BATCH]
            id_list = ",".join(f"'{eid}'" for eid in batch)
            condition = f"id IN ({id_list})"
            result = await tinybird_client.delete(DATASOURCE_EVENTS, condition)
            total += await _await_tinybird_job(result)
            progress.advance(task, advance=len(batch))
    return total


@cli.command()
@typer_async
async def cleanup(
    dry_run: bool = typer.Option(
        True, help="Print what would be deleted without acting"
    ),
    delete_events: bool = typer.Option(
        False,
        "--delete-events",
        help=(
            "Also delete subscription.* / order.* / balance_order system events "
            "from Postgres AND Tinybird for the deleted subs/orders."
        ),
    ),
) -> None:
    """Delete free-plan Subscriptions and their $0 Orders for the Polar org.

    Polar-for-Polar originally modeled the free tier as a real Subscription on
    POLAR_FREE_PRODUCT_ID. We're rolling that decision back so the free plan is
    "subscriptionless". This wipes the free subscriptions and the $0 orders they
    generated. Customer records (and their members) are kept.

    With --delete-events, also removes the system events those subs/orders
    generated from both Postgres and Tinybird.
    """
    configure_script_logging()

    if not settings.POLAR_SELF_ENABLED:
        typer.echo(
            "POLAR_ACCESS_TOKEN, POLAR_ORGANIZATION_ID, or POLAR_FREE_PRODUCT_ID "
            "is not configured, aborting.",
            err=True,
        )
        raise typer.Exit(code=1)

    organization_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)
    free_product_id = uuid.UUID(settings.POLAR_FREE_PRODUCT_ID)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            subscription_ids = await _list_free_subscription_ids(
                session, product_id=free_product_id
            )
            order_ids = await _list_zero_order_ids(
                session,
                organization_id=organization_id,
                subscription_ids=subscription_ids,
            )
            event_ids: list[uuid.UUID] = []
            if delete_events:
                event_ids = await _list_event_ids(
                    session,
                    organization_id=organization_id,
                    subscription_ids=subscription_ids,
                    order_ids=order_ids,
                )

        typer.echo(
            f"Polar org: {organization_id}\n"
            f"Free product: {free_product_id}\n"
            f"Free subscriptions to delete: {len(subscription_ids)}\n"
            f"$0 orders to delete: {len(order_ids)}"
        )
        if delete_events:
            typer.echo(f"System events to delete (PG + Tinybird): {len(event_ids)}")

        if not subscription_ids:
            typer.echo("Nothing to do.")
            return

        if dry_run:
            typer.echo("\nDry run — pass --no-dry-run to actually delete.")
            return

        if delete_events and event_ids:
            tb_deleted = await _delete_events_tinybird(event_ids)
            typer.echo(f"Deleted {tb_deleted} events from Tinybird.")
            pg_events_deleted = 0
            with Progress() as progress:
                task = progress.add_task(
                    "[cyan]Deleting events from Postgres...", total=len(event_ids)
                )
                for start in range(0, len(event_ids), BATCH_SIZE * 10):
                    batch = event_ids[start : start + BATCH_SIZE * 10]
                    async with sessionmaker() as session:
                        pg_events_deleted += await _delete_events(session, batch)
                        await session.commit()
                    progress.advance(task, advance=len(batch))
            typer.echo(f"Deleted {pg_events_deleted} events from Postgres.")

        total_orders = 0
        total_subs = 0
        with Progress() as progress:
            task = progress.add_task(
                "[cyan]Deleting free subscriptions...", total=len(subscription_ids)
            )
            for start in range(0, len(subscription_ids), BATCH_SIZE):
                batch = subscription_ids[start : start + BATCH_SIZE]
                async with sessionmaker() as session:
                    orders_deleted = await _delete_zero_orders(
                        session,
                        organization_id=organization_id,
                        subscription_ids=batch,
                    )
                    subs_deleted = await _delete_subscriptions(session, batch)
                    await session.commit()
                total_orders += orders_deleted
                total_subs += subs_deleted
                progress.advance(task, advance=len(batch))

        typer.echo(
            f"\nDeleted {total_subs} subscriptions and {total_orders} $0 orders."
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
