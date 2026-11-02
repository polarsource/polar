"""Splits the usage buckets that span the latest reset of a customer meter.

The reducer only counts buckets starting at or after the latest reset, so a bucket
spanning it leaves the usage between the reset and the bucket's end out. Resets
before `reducer.seal` existed were never split, and `backfill_reducer_buckets`
merges splits back, as it only splits at subscription starts.

Usage:

    uv run python -m scripts.backfill_missing_buckets_splits_from_resets [--execute]

Defaults to a dry-run listing the customer meters to split; pass --execute to seal
them at their latest reset, like `reducer.seal` does after a reset. A sealed bucket,
or one with several generations, can't be split: those are reported as not split,
with the reason in the logs.
"""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

import dramatiq
import typer
from sqlalchemy import Row, and_, or_, select, text

from polar import tasks  # noqa: F401
from polar.customer.repository import CustomerRepository
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Customer, MeterReducer, Reducer, ReducerBucket
from polar.models.reducer import ReducerKind
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.reducer.bucket_repository import get_customer_identities
from polar.reducer.service import reducer as reducer_service
from polar.worker import JobQueueManager

from .helper import configure_script_console_logging, read_engine, typer_async

cli = typer.Typer()

# One lookup per identity: Postgres won't serve an OR of identities from the
# identity index.
_SPANNING_BUCKET = """
  SELECT 1 FROM reducer_buckets b
  WHERE b.organization_id = r.organization_id AND b.reducer_id = red.id
    AND {identity}
    AND b.bucket_start > r.reset_at - interval '5 minutes'
    AND b.bucket_start < r.reset_at AND b.bucket_end > r.reset_at
    AND b.count > 0
"""

MISSING_SPLITS = text(
    f"""
WITH customers_with_meters AS MATERIALIZED (
  SELECT DISTINCT customer_id FROM customer_meters
),
latest_resets AS MATERIALIZED (
  SELECT c.organization_id, c.id AS customer_id, c.external_id, l.meter_id, l.reset_at
  FROM customers_with_meters cwm
  JOIN customers c ON c.id = cwm.customer_id AND c.deleted_at IS NULL
  CROSS JOIN LATERAL (
    SELECT DISTINCT ON (events.user_metadata->>'meter_id')
      (events.user_metadata->>'meter_id')::uuid AS meter_id,
      events.timestamp AS reset_at
    FROM events
    WHERE events.organization_id = c.organization_id
      AND events.source = 'system'
      AND events.name = 'meter.reset'
      AND events.customer_id = c.id
    ORDER BY events.user_metadata->>'meter_id', events.timestamp DESC
  ) l
)
SELECT DISTINCT r.customer_id, r.meter_id, r.reset_at
FROM latest_resets r
JOIN meter_reducers mr ON mr.meter_id = r.meter_id
JOIN reducers red ON red.id = mr.reducer_id AND red.kind = 'usage'
CROSS JOIN LATERAL (
  {_SPANNING_BUCKET.format(identity="b.customer_id = r.customer_id AND b.external_customer_id IS NULL")}
  UNION ALL
  {_SPANNING_BUCKET.format(identity="b.customer_id IS NULL AND b.external_customer_id = r.external_id")}
  UNION ALL
  {_SPANNING_BUCKET.format(identity="b.customer_id = r.customer_id AND b.external_customer_id = r.external_id")}
) b
ORDER BY r.reset_at
"""
)


async def find_missing_splits(session: AsyncSession) -> Sequence[Row[Any]]:
    """customer_id, meter_id and reset_at of each customer meter whose latest
    reset is inside one of its usage buckets with usage."""
    return (await session.execute(MISSING_SPLITS)).all()


async def _spans(
    session: AsyncSession, customer: Customer, meter_id: uuid.UUID, at: datetime
) -> bool:
    """Whether one of the customer's usage buckets of the meter with usage spans
    `at`."""
    statement = (
        select(ReducerBucket.id)
        .join(Reducer, Reducer.id == ReducerBucket.reducer_id)
        .join(MeterReducer, MeterReducer.reducer_id == Reducer.id)
        .where(
            MeterReducer.meter_id == meter_id,
            Reducer.kind == ReducerKind.usage,
            ReducerBucket.organization_id == customer.organization_id,
            or_(
                *(
                    and_(
                        ReducerBucket.customer_id == customer_id,
                        ReducerBucket.external_customer_id == external_customer_id,
                    )
                    for customer_id, external_customer_id in get_customer_identities(
                        customer
                    )
                )
            ),
            ReducerBucket.bucket_start < at,
            ReducerBucket.bucket_end > at,
            ReducerBucket.count > 0,
        )
        .limit(1)
    )
    return (await session.execute(statement)).first() is not None


async def split(
    session: AsyncSession, customer_id: uuid.UUID, meter_id: uuid.UUID, at: datetime
) -> bool:
    """Seals the customer meter at `at`, and returns whether `at` is now a bucket
    boundary: `seal` logs its failures and skipped splits instead of raising."""
    customer = await CustomerRepository.from_session(session).get_by_id(customer_id)
    if customer is None:
        return False
    await reducer_service.seal(session, customer, meter_id, at=at)
    return not await _spans(session, customer, meter_id, at)


@cli.command()
@typer_async
async def backfill(
    execute: bool = typer.Option(
        False, "--execute", help="Actually split the buckets (default: dry-run)."
    ),
    yes: bool = typer.Option(False, "--yes", help="Skip the confirmation prompt."),
) -> None:
    configure_script_console_logging()
    read = read_engine(command_timeout=3600)
    try:
        async with create_async_sessionmaker(read)() as session:
            missing = await find_missing_splits(session)
    finally:
        await read.dispose()

    for row in missing:
        typer.echo(
            f"customer {row.customer_id} meter {row.meter_id}: "
            f"reset at {row.reset_at.isoformat()}"
        )
    typer.echo(f"{len(missing)} customer meter(s) to split.")
    if not missing:
        return
    if not execute:
        typer.echo("Dry run: nothing split. Pass --execute to apply.")
        return
    if not yes and not typer.confirm("Proceed?"):
        raise typer.Exit(code=1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("app")
    not_split = 0
    try:
        for row in missing:
            async with JobQueueManager.open(dramatiq.get_broker(), redis):
                async with sessionmaker.begin() as session:
                    if not await split(
                        session, row.customer_id, row.meter_id, row.reset_at
                    ):
                        not_split += 1
                        typer.echo(
                            f"customer {row.customer_id} meter {row.meter_id}: "
                            "not split (customer deleted, bucket sealed, or seal "
                            "failed: see the logs above)"
                        )
    finally:
        await engine.dispose()
    typer.echo(f"Split {len(missing) - not_split} of {len(missing)} customer meter(s).")


if __name__ == "__main__":
    cli()
