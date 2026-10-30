import uuid
from datetime import datetime
from typing import Annotated

from polar.customer.repository import CustomerRepository
from polar.customer_meter.repository import CustomerMeterRepository
from polar.exceptions import PolarTaskError
from polar.meter.aggregation import AggregationFunction
from polar.observability.task_logging import LoggableField
from polar.worker import (
    AsyncReadSessionMaker,
    AsyncSessionMaker,
    CronTrigger,
    RedisMiddleware,
    TaskPriority,
    actor,
)

from . import cache
from .redis_store import get_reducer_bucket_key
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


@actor(
    actor_name="reducer.compare_highest_consumed_units",
    cron_trigger=CronTrigger.from_crontab("*/5 * * * *"),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def compare_highest_consumed_units() -> None:
    async with AsyncReadSessionMaker() as session:
        repository = CustomerMeterRepository.from_session(session)
        redis = RedisMiddleware.get()
        for aggregation_function in AggregationFunction:
            if aggregation_function == AggregationFunction.unique:
                continue
            for customer_meter in await repository.get_all_by_highest_consumed_units(
                aggregation_function, 10
            ):
                await reducer_service.log_customer_meter_comparison(
                    session, redis, customer_meter
                )


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
        await reducer_service.seal(
            session, customer, meter_id, at=datetime.fromisoformat(at)
        )


def _sync_debounce_key(
    reducer_id: uuid.UUID,
    bucket_start: str,
    customer_id: uuid.UUID | None,
    external_customer_id: str | None,
) -> str:
    return "reducer_bucket.sync:" + get_reducer_bucket_key(
        reducer_id,
        datetime.fromisoformat(bucket_start),
        customer_id,
        external_customer_id,
    )


@actor(
    actor_name="reducer_bucket.sync",
    priority=TaskPriority.LOW,
    debounce_key=_sync_debounce_key,
    debounce_min_threshold=10,
    debounce_max_threshold=360,
)
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
