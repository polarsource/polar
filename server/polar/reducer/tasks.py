import uuid
from datetime import datetime
from typing import Annotated

from apscheduler.triggers.cron import CronTrigger

from polar.billing_interval.service import billing_interval as billing_interval_service
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarTaskError
from polar.observability.task_logging import LoggableField
from polar.worker import (
    AsyncSessionMaker,
    RedisMiddleware,
    TaskPriority,
    actor,
    get_message_timestamp,
)

from . import cache
from .service import reducer as reducer_service


class CustomerDoesNotExist(PolarTaskError):
    def __init__(self, customer_id: uuid.UUID) -> None:
        self.customer_id = customer_id
        super().__init__(f"The customer with id {customer_id} does not exist.")


@actor(actor_name="reducer.invalidate_cache", priority=TaskPriority.HIGH)
async def invalidate_cache(
    organization_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    await cache.invalidate(RedisMiddleware.get(), organization_id)


@actor(actor_name="reducer.seal", priority=TaskPriority.LOW)
async def seal(
    customer_id: Annotated[uuid.UUID, LoggableField],
    meter_id: Annotated[uuid.UUID, LoggableField],
    at: Annotated[str, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        customer = await CustomerRepository.from_session(session).get_by_id(
            customer_id, include_deleted=True
        )
        if customer is None:
            raise CustomerDoesNotExist(customer_id)
        seal_at = datetime.fromisoformat(at)
        boundaries = await billing_interval_service.get_boundaries(
            session, customer, meter_id, until=seal_at
        )
        await reducer_service.seal(
            session, customer, meter_id, at=seal_at, boundaries=boundaries
        )


@actor(actor_name="reducer_bucket.sync", priority=TaskPriority.LOW)
async def sync(
    reducer_id: Annotated[uuid.UUID, LoggableField],
    bucket_start: Annotated[str, LoggableField],
    customer_id: Annotated[uuid.UUID | None, LoggableField],
    external_customer_id: str | None,
) -> None:
    async with AsyncSessionMaker() as session:
        await reducer_service.sync_bucket(
            session,
            reducer_id,
            datetime.fromisoformat(bucket_start),
            customer_id,
            external_customer_id,
        )


@actor(
    actor_name="reducer_bucket.enqueue_syncs",
    # A minute after each window closes, once the requests writing to it committed
    cron_trigger=CronTrigger.from_crontab("1-59/5 * * * *"),
    priority=TaskPriority.LOW,
    # Retried within the window: its buckets must reach Postgres before live
    # reads stop looking for them in Redis.
    max_retries=4,
    min_backoff=5_000,
    max_backoff=60_000,
)
async def enqueue_syncs() -> None:
    async with AsyncSessionMaker() as session:
        # The scheduled time, so a run delayed behind a backlog still syncs its windows
        await reducer_service.enqueue_bucket_syncs(session, at=get_message_timestamp())
