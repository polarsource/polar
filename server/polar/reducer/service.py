import asyncio
from datetime import datetime
from decimal import Decimal
from uuid import UUID

import logfire

from polar.customer.repository import CustomerRepository
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction, UniqueAggregation
from polar.models import Customer, Meter, MeterReducer, Reducer
from polar.postgres import AsyncReadSession, AsyncSession
from polar.redis import Redis, create_redis
from polar.reducer_bucket.redis_store import get_reducer_bucket_key
from polar.reducer_bucket.repository import ReducerBucketRepository
from polar.reducer_bucket.service import (
    REDUCER_BUCKET_SIZE,
    get_reducer_bucket_start,
)

from .aggregation import Aggregate
from .repository import ReducerRepository


class ReducerService:
    async def _get_redis_aggregate(
        self,
        redis: Redis,
        reducer: Reducer,
        customer: Customer,
        *,
        start: datetime,
        end: datetime,
        exclude_bucket: datetime | None,
    ) -> Aggregate:
        aggregate = Aggregate()
        identities: list[tuple[UUID | None, str | None]] = [(customer.id, None)]
        if customer.external_id is not None:
            identities.extend(
                [(None, customer.external_id), (customer.id, customer.external_id)]
            )
        async with redis.pipeline(transaction=False) as pipeline:
            bucket_start = start
            while bucket_start < end:
                if bucket_start != exclude_bucket:
                    for internal_id, external_id in identities:
                        key = get_reducer_bucket_key(
                            reducer.id, bucket_start, internal_id, external_id
                        )
                        match reducer.aggregation.func:
                            case AggregationFunction.avg:
                                pipeline.hmget(key, ["count", "sum"])
                            case AggregationFunction.min | AggregationFunction.max:
                                pipeline.zscore(key, reducer.aggregation.func.value)
                            case _:
                                pipeline.get(key)
                bucket_start += REDUCER_BUCKET_SIZE
            async with asyncio.timeout(5):
                values = await pipeline.execute()
        for value in values:
            if value is None:
                continue
            match reducer.aggregation.func:
                case AggregationFunction.avg:
                    count, total = value
                    if count is not None and total is not None:
                        aggregate.add(
                            Aggregate(count=int(count), total=Decimal(str(total)))
                        )
                case AggregationFunction.cnt:
                    aggregate.add(Aggregate(count=int(value)))
                case AggregationFunction.sum:
                    aggregate.add(Aggregate(total=Decimal(str(value))))
                case _:
                    number = Decimal(str(value))
                    aggregate.add(Aggregate(minimum=number, maximum=number))

        return aggregate

    async def _get_boundary_aggregate(
        self,
        bucket_repository: ReducerBucketRepository,
        reducer: Reducer,
        customer: Customer,
        *,
        start: datetime | None,
        end: datetime,
    ) -> Aggregate:
        aggregate = Aggregate()
        full_end = get_reducer_bucket_start(end)
        partial_start = None
        if start is not None and get_reducer_bucket_start(start) != start:
            partial_start = get_reducer_bucket_start(start)
            edge_end = min(partial_start + REDUCER_BUCKET_SIZE, end)
            aggregate.add(
                await bucket_repository.get_edge_aggregate(
                    reducer, customer, start=start, end=edge_end
                )
            )
        if full_end < end and full_end != partial_start:
            aggregate.add(
                await bucket_repository.get_edge_aggregate(
                    reducer, customer, start=full_end, end=end
                )
            )
        return aggregate

    async def get_quantity(
        self,
        session: AsyncReadSession,
        redis: Redis,
        *,
        meter_id: UUID,
        customer_id: UUID,
        start: datetime | None,
        end: datetime,
    ) -> Decimal | None:
        """Read usage from whole unsealed buckets in Postgres and Redis.

        Include unsealed buckets dated before start to count late-arriving usage
        that has not been charged yet. Read raw events where the requested window
        covers only part of a bucket.
        """
        bucket_repository = ReducerBucketRepository.from_session(session)
        reducer = await ReducerRepository.from_session(session).get_by_meter_id(
            meter_id
        )
        if reducer is None or isinstance(reducer.aggregation, UniqueAggregation):
            return None
        customer = await CustomerRepository.from_session(session).get_by_id(
            customer_id, include_deleted=True
        )
        if customer is None or customer.organization_id != reducer.organization_id:
            return None
        if start is not None and start >= end:
            return Decimal(0)

        full_end = get_reducer_bucket_start(end)
        start_bucket = get_reducer_bucket_start(start) if start is not None else None
        partial_start = start_bucket if start_bucket != start else None
        redis_start = get_reducer_bucket_start(utc_now()) - REDUCER_BUCKET_SIZE
        with logfire.span("reducer.read_postgres_buckets"):
            aggregate = await bucket_repository.get_unsealed_aggregate(
                reducer,
                customer,
                end=min(full_end, redis_start),
                exclude_bucket=partial_start,
            )
        with logfire.span("reducer.read_redis_buckets"):
            aggregate.add(
                await self._get_redis_aggregate(
                    redis,
                    reducer,
                    customer,
                    start=redis_start,
                    end=full_end,
                    exclude_bucket=partial_start,
                )
            )
        with logfire.span("reducer.read_boundary_events"):
            aggregate.add(
                await self._get_boundary_aggregate(
                    bucket_repository,
                    reducer,
                    customer,
                    start=start,
                    end=end,
                )
            )
        return aggregate.quantity(reducer.aggregation.func)

    async def compare_quantity(
        self,
        session: AsyncSession,
        *,
        meter_id: UUID,
        customer_id: UUID,
        start: datetime | None,
        end: datetime,
        expected: Decimal | float,
        consumer: str,
    ) -> None:
        with logfire.span(
            "reducer.compare_quantity",
            meter_id=str(meter_id),
            customer_id=str(customer_id),
            start=start,
            end=end,
            consumer=consumer,
            legacy_quantity=str(expected),
        ) as span:
            try:
                async with session.begin_nested(), create_redis("app") as redis:
                    actual = await self.get_quantity(
                        session,
                        redis,
                        meter_id=meter_id,
                        customer_id=customer_id,
                        start=start,
                        end=end,
                    )
                if actual is None:
                    span.set_attribute("comparison_status", "unavailable")
                else:
                    difference = actual - Decimal(str(expected))
                    span.set_attribute("reducer_quantity", str(actual))
                    span.set_attribute("difference", str(difference))
                    span.set_attribute(
                        "comparison_status", "match" if difference == 0 else "mismatch"
                    )
            except Exception as error:
                span.set_attribute("comparison_status", "error")
                span.set_attribute("error_type", type(error).__name__)

    async def sync_meter(self, session: AsyncSession, meter: Meter) -> Reducer:
        repository = ReducerRepository.from_session(session)
        meter = await repository.get_meter_for_update(meter.id)
        reducer = await repository.get_by_meter_id(meter.id)
        if reducer is not None:
            return await repository.update(
                reducer,
                update_dict={"filter": meter.filter, "aggregation": meter.aggregation},
            )

        reducer = await repository.create(
            Reducer(
                organization=meter.organization,
                filter=meter.filter,
                aggregation=meter.aggregation,
            )
        )
        session.add(MeterReducer(meter=meter, reducer=reducer))
        return reducer


reducer = ReducerService()
