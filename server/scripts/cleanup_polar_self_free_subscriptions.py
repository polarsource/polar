import asyncio
import uuid
from typing import Any

import structlog
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

log = structlog.get_logger()

cli = typer.Typer()

DEFAULT_BATCH_SIZE = 1000


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
    statement = select(Order.id).where(
        Order.organization_id == organization_id,
        Order.subscription_id.in_(subscription_ids),
        Order.deleted_at.is_(None),
        (Order.net_amount + Order.tax_amount) == 0,
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
    clauses = []
    if subscription_ids:
        clauses.append(
            Event.user_metadata["subscription_id"]
            .as_string()
            .in_([str(s) for s in subscription_ids])
        )
    if order_ids:
        clauses.append(
            Event.user_metadata["order_id"].as_string().in_([str(o) for o in order_ids])
        )
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


async def _delete_events_tinybird(
    *, organization_id: uuid.UUID, event_ids: list[uuid.UUID]
) -> int:
    if not event_ids:
        return 0
    id_list = ",".join(f"'{uuid.UUID(str(eid))}'" for eid in event_ids)
    condition = f"organization_id = '{organization_id}' AND id IN ({id_list})"
    result = await tinybird_client.delete(DATASOURCE_EVENTS, condition)
    return await _await_tinybird_job(result)


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
    batch_size: int = typer.Option(
        DEFAULT_BATCH_SIZE,
        help=(
            "Subscriptions processed per batch. Lower this if event/order IN "
            "queries time out for the org."
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

    Pause the dramatiq worker (or at least the subscription.cycle / polar_self
    actors) before running with --no-dry-run, otherwise new events/orders may
    race the cleanup.
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

        typer.echo(
            f"Polar org: {organization_id}\n"
            f"Free product: {free_product_id}\n"
            f"Free subscriptions: {len(subscription_ids)}"
        )

        if not subscription_ids:
            typer.echo("Nothing to do.")
            return

        total_orders = 0
        total_subs = 0
        total_events_pg = 0
        total_events_tb = 0

        with Progress() as progress:
            label = "Counting" if dry_run else "Deleting"
            task = progress.add_task(
                f"[cyan]{label} free subscriptions...", total=len(subscription_ids)
            )
            for start in range(0, len(subscription_ids), batch_size):
                sub_batch = subscription_ids[start : start + batch_size]
                async with sessionmaker() as session:
                    order_ids = await _list_zero_order_ids(
                        session,
                        organization_id=organization_id,
                        subscription_ids=sub_batch,
                    )
                    event_ids: list[uuid.UUID] = []
                    if delete_events:
                        event_ids = await _list_event_ids(
                            session,
                            organization_id=organization_id,
                            subscription_ids=sub_batch,
                            order_ids=order_ids,
                        )

                    if dry_run:
                        total_orders += len(order_ids)
                        total_subs += len(sub_batch)
                        total_events_pg += len(event_ids)
                    else:
                        if event_ids:
                            total_events_pg += await _delete_events(session, event_ids)
                        total_orders += await _delete_zero_orders(
                            session,
                            organization_id=organization_id,
                            subscription_ids=sub_batch,
                        )
                        total_subs += await _delete_subscriptions(session, sub_batch)
                        await session.commit()

                        if event_ids:
                            try:
                                total_events_tb += await _delete_events_tinybird(
                                    organization_id=organization_id,
                                    event_ids=event_ids,
                                )
                            except Exception as e:
                                log.warning(
                                    "tinybird_event_delete_failed",
                                    error=str(e),
                                    organization_id=str(organization_id),
                                    event_ids=[str(eid) for eid in event_ids],
                                )

                progress.advance(task, advance=len(sub_batch))

        if dry_run:
            summary = (
                f"\nDry run summary:\n"
                f"  Subscriptions to delete: {total_subs}\n"
                f"  $0 orders to delete: {total_orders}"
            )
            if delete_events:
                summary += f"\n  System events to delete: {total_events_pg}"
            summary += "\n\nPass --no-dry-run to actually delete."
            typer.echo(summary)
        else:
            summary = (
                f"\nDeleted:\n  {total_subs} subscriptions\n  {total_orders} $0 orders"
            )
            if delete_events:
                summary += (
                    f"\n  {total_events_pg} events from Postgres\n"
                    f"  {total_events_tb} events from Tinybird"
                )
            typer.echo(summary)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
