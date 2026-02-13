import asyncio
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import typer
from rich.progress import Progress
from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import selectinload

from polar.config import settings
from polar.event.repository import EventRepository
from polar.event.system import SubscriptionCanceledMetadata, SystemEvent
from polar.integrations.tinybird.client import (
    TinybirdClient,
    TinybirdPayloadTooLargeError,
)
from polar.integrations.tinybird.service import DATASOURCE_EVENTS, _event_to_tinybird
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Event, Subscription
from polar.models.event import EventSource
from polar.models.subscription import CustomerCancellationReason

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

EPOCH = datetime(1970, 1, 1, tzinfo=UTC)
OTHER_REASON_BUCKET = CustomerCancellationReason.other.value
KNOWN_REASON_BUCKETS = {reason.value for reason in CustomerCancellationReason}
CANCELED_AT_LEEWAY = timedelta(minutes=15)


@dataclass
class LatestCanceledEvent:
    event: Event
    canceled_at: datetime | None
    reason_bucket: str
    sort_key: tuple[datetime, datetime, datetime, str]


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    if value == "":
        return None

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _reason_bucket(value: Any) -> str:
    if isinstance(value, CustomerCancellationReason):
        normalized = value.value
    elif isinstance(value, str):
        normalized = value.strip()
    else:
        normalized = ""

    if normalized == "":
        return OTHER_REASON_BUCKET
    if normalized in KNOWN_REASON_BUCKETS:
        return normalized
    return OTHER_REASON_BUCKET


def _build_canceled_metadata(
    subscription: Subscription,
) -> SubscriptionCanceledMetadata:
    assert subscription.canceled_at is not None

    metadata = SubscriptionCanceledMetadata(
        subscription_id=str(subscription.id),
        product_id=str(subscription.product_id),
        amount=subscription.amount,
        currency=subscription.currency,
        recurring_interval=subscription.recurring_interval.value,
        recurring_interval_count=subscription.recurring_interval_count,
        canceled_at=subscription.canceled_at.isoformat(),
    )

    if subscription.customer_cancellation_reason is not None:
        metadata["customer_cancellation_reason"] = (
            subscription.customer_cancellation_reason.value
        )
    if subscription.customer_cancellation_comment is not None:
        metadata["customer_cancellation_comment"] = (
            subscription.customer_cancellation_comment
        )
    if subscription.ends_at is not None:
        metadata["ends_at"] = subscription.ends_at.isoformat()

    metadata["cancel_at_period_end"] = subscription.cancel_at_period_end
    return metadata


def _build_latest_canceled_event_index(
    events: list[Event],
) -> dict[str, LatestCanceledEvent]:
    latest_events: dict[str, LatestCanceledEvent] = {}

    for event in events:
        if not event.user_metadata:
            continue

        subscription_id = event.user_metadata.get("subscription_id")
        if not isinstance(subscription_id, str):
            continue

        canceled_at = _parse_datetime(event.user_metadata.get("canceled_at"))
        sort_key = (
            canceled_at or EPOCH,
            event.timestamp,
            event.ingested_at,
            str(event.id),
        )

        latest_event = LatestCanceledEvent(
            event=event,
            canceled_at=canceled_at,
            reason_bucket=_reason_bucket(
                event.user_metadata.get("customer_cancellation_reason")
            ),
            sort_key=sort_key,
        )

        current = latest_events.get(subscription_id)
        if current is None or current.sort_key < latest_event.sort_key:
            latest_events[subscription_id] = latest_event

    return latest_events


def _needs_corrective_event(
    subscription: Subscription, latest_event: LatestCanceledEvent
) -> bool:
    assert subscription.canceled_at is not None

    subscription_canceled_at = subscription.canceled_at.astimezone(UTC)
    latest_event_canceled_at = (
        latest_event.canceled_at.astimezone(UTC)
        if latest_event.canceled_at is not None
        else None
    )

    if latest_event_canceled_at is None:
        return True

    if abs(latest_event_canceled_at - subscription_canceled_at) > CANCELED_AT_LEEWAY:
        return True

    subscription_reason_bucket = _reason_bucket(
        subscription.customer_cancellation_reason
    )
    return latest_event.reason_bucket != subscription_reason_bucket


def _corrective_event_timestamp(subscription: Subscription) -> datetime:
    assert subscription.canceled_at is not None
    return subscription.canceled_at


async def _ingest_tinybird_batch(
    client: TinybirdClient,
    events: list[Event],
) -> None:
    if not events:
        return

    tinybird_events = [_event_to_tinybird(event) for event in events]

    try:
        await client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=False)
    except TinybirdPayloadTooLargeError:
        if len(events) <= 1:
            raise

        midpoint = len(events) // 2
        await _ingest_tinybird_batch(client, events[:midpoint])
        await _ingest_tinybird_batch(client, events[midpoint:])


def _is_canonical_event_for_subscription(
    subscription: Subscription, event: Event
) -> bool:
    if not event.user_metadata:
        return False

    assert subscription.canceled_at is not None

    event_canceled_at = _parse_datetime(event.user_metadata.get("canceled_at"))
    if event_canceled_at != subscription.canceled_at:
        return False

    event_reason_bucket = _reason_bucket(
        event.user_metadata.get("customer_cancellation_reason")
    )
    subscription_reason_bucket = _reason_bucket(
        subscription.customer_cancellation_reason
    )
    return event_reason_bucket == subscription_reason_bucket


async def run_backfill(
    subscription_batch_size: int = settings.DATABASE_STREAM_YIELD_PER,
    insert_batch_size: int = 500,
    rate_limit_delay: float = 0.1,
    dry_run: bool = False,
    ingest_tinybird: bool = True,
    session: AsyncSession | None = None,
) -> dict[str, int]:
    engine = None
    own_session = False

    if session is None:
        engine = _create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.backfill_subscription_canceled",
            debug=False,
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    tinybird_client: TinybirdClient | None = None
    if not dry_run and ingest_tinybird:
        tinybird_client = TinybirdClient(
            api_url=settings.TINYBIRD_API_URL,
            clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
            api_token=settings.TINYBIRD_API_TOKEN,
            read_token=settings.TINYBIRD_READ_TOKEN,
            clickhouse_username=settings.TINYBIRD_CLICKHOUSE_USERNAME,
            clickhouse_token=settings.TINYBIRD_CLICKHOUSE_TOKEN,
        )

    results = {
        "subscriptions_scanned": 0,
        "affected_subscriptions": 0,
        "corrective_events_inserted": 0,
        "tinybird_events_ingested": 0,
    }

    try:
        total_subscriptions = (
            await session.execute(
                select(func.count())
                .select_from(Subscription)
                .where(Subscription.canceled_at.is_not(None))
            )
        ).scalar_one()

        if total_subscriptions == 0:
            typer.echo("No canceled subscriptions to process")
            return results

        typer.echo(
            f"Scanning {total_subscriptions} canceled subscriptions for mismatched canceled events"
        )

        last_canceled_at: datetime | None = None
        last_subscription_id: UUID | None = None
        event_repository = EventRepository.from_session(session)

        with Progress() as progress:
            task = progress.add_task(
                "[cyan]Backfilling canceled subscription events...",
                total=total_subscriptions,
            )

            while True:
                subscriptions_statement = (
                    select(Subscription)
                    .where(Subscription.canceled_at.is_not(None))
                    .options(selectinload(Subscription.customer))
                    .order_by(Subscription.canceled_at.asc(), Subscription.id.asc())
                    .limit(subscription_batch_size)
                )
                if last_canceled_at is not None and last_subscription_id is not None:
                    subscriptions_statement = subscriptions_statement.where(
                        tuple_(Subscription.canceled_at, Subscription.id)
                        > (last_canceled_at, last_subscription_id)
                    )

                subscriptions_result = await session.execute(subscriptions_statement)
                subscriptions = list(subscriptions_result.scalars().all())

                if not subscriptions:
                    break

                last_canceled_at = subscriptions[-1].canceled_at
                last_subscription_id = subscriptions[-1].id
                results["subscriptions_scanned"] += len(subscriptions)

                subscription_id_strings = [
                    str(subscription.id) for subscription in subscriptions
                ]
                organization_ids = {
                    subscription.customer.organization_id
                    for subscription in subscriptions
                }
                customer_ids = {
                    subscription.customer_id for subscription in subscriptions
                }
                events_result = await session.execute(
                    select(Event).where(
                        Event.name == SystemEvent.subscription_canceled,
                        Event.source == EventSource.system,
                        Event.customer_id.is_not(None),
                        Event.organization_id.in_(organization_ids),
                        Event.customer_id.in_(customer_ids),
                        Event.user_metadata["subscription_id"]
                        .as_string()
                        .in_(subscription_id_strings),
                    )
                )
                canceled_events = list(events_result.scalars().all())
                events_by_subscription: dict[str, list[Event]] = defaultdict(list)
                for event in canceled_events:
                    if not event.user_metadata:
                        continue
                    subscription_id = event.user_metadata.get("subscription_id")
                    if not isinstance(subscription_id, str):
                        continue
                    events_by_subscription[subscription_id].append(event)

                latest_events = _build_latest_canceled_event_index(canceled_events)

                corrective_events: list[dict[str, Any]] = []

                for subscription in subscriptions:
                    latest_event = latest_events.get(str(subscription.id))
                    if latest_event is None:
                        continue
                    if not _needs_corrective_event(subscription, latest_event):
                        continue

                    results["affected_subscriptions"] += 1

                    subscription_events = events_by_subscription.get(
                        str(subscription.id), []
                    )
                    if any(
                        _is_canonical_event_for_subscription(subscription, event)
                        for event in subscription_events
                    ):
                        continue

                    assert subscription.canceled_at is not None
                    metadata = dict(_build_canceled_metadata(subscription))

                    corrective_events.append(
                        {
                            "name": SystemEvent.subscription_canceled,
                            "source": EventSource.system,
                            "timestamp": _corrective_event_timestamp(subscription),
                            "customer_id": subscription.customer_id,
                            "organization_id": subscription.customer.organization_id,
                            "user_metadata": metadata,
                        }
                    )

                if not dry_run:
                    for start in range(0, len(corrective_events), insert_batch_size):
                        insert_batch = corrective_events[
                            start : start + insert_batch_size
                        ]
                        inserted_ids, _ = await event_repository.insert_batch(
                            insert_batch
                        )
                        await session.commit()

                        if not inserted_ids:
                            continue

                        results["corrective_events_inserted"] += len(inserted_ids)

                        if tinybird_client is not None:
                            inserted_events_result = await session.execute(
                                select(Event).where(Event.id.in_(inserted_ids))
                            )
                            inserted_events = list(
                                inserted_events_result.scalars().all()
                            )
                            await _ingest_tinybird_batch(
                                tinybird_client, inserted_events
                            )
                            results["tinybird_events_ingested"] += len(inserted_events)

                        if rate_limit_delay > 0:
                            await asyncio.sleep(rate_limit_delay)

                progress.update(task, advance=len(subscriptions))

                if len(subscriptions) < subscription_batch_size:
                    break

                if rate_limit_delay > 0:
                    await asyncio.sleep(rate_limit_delay)

        typer.echo(
            f"Affected subscriptions: {results['affected_subscriptions']}, "
            f"inserted events: {results['corrective_events_inserted']}, "
            f"Tinybird ingested: {results['tinybird_events_ingested']}"
        )
        return results

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()


@cli.command()
@typer_async
async def backfill(
    subscription_batch_size: int = typer.Option(
        settings.DATABASE_STREAM_YIELD_PER,
        help="Canceled subscriptions to scan per batch",
    ),
    insert_batch_size: int = typer.Option(
        500,
        help="Corrective events to insert per batch",
    ),
    rate_limit_delay: float = typer.Option(
        0.1,
        help="Delay in seconds between batches",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Only count affected subscriptions without inserting events",
    ),
    ingest_tinybird: bool = typer.Option(
        True,
        "--ingest-tinybird/--skip-tinybird",
        help="Ingest inserted corrective events to Tinybird",
    ),
) -> None:
    configure_script_logging()

    results = await run_backfill(
        subscription_batch_size=subscription_batch_size,
        insert_batch_size=insert_batch_size,
        rate_limit_delay=rate_limit_delay,
        dry_run=dry_run,
        ingest_tinybird=ingest_tinybird,
    )

    typer.echo("\n=== Backfill Summary ===")
    for key, value in results.items():
        typer.echo(f"{key}: {value}")


if __name__ == "__main__":
    cli()
