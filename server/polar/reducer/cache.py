from collections.abc import Sequence
from uuid import UUID

import structlog
from pydantic import TypeAdapter
from redis.exceptions import RedisError, WatchError

from polar.kit.schemas import Schema
from polar.logging import Logger
from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter
from polar.models import Reducer
from polar.postgres import AsyncSession
from polar.redis import Redis

from .repository import ReducerRepository

log: Logger = structlog.get_logger()

REDUCERS_CACHE_TTL_SECONDS = 6 * 60 * 60


class CachedReducer(Schema):
    id: UUID
    organization_id: UUID
    filter: Filter
    aggregation: Aggregation


cached_reducers_adapter = TypeAdapter(list[CachedReducer])


def get_cache_key(organization_id: UUID) -> str:
    return f"reducers:active:v1:{organization_id}"


async def invalidate(redis: Redis, organization_id: UUID) -> None:
    # DELETE on a missing key won't trigger WATCH; SET blocks stale cache refills.
    await redis.set(get_cache_key(organization_id), "", ex=REDUCERS_CACHE_TTL_SECONDS)


async def get_active_reducers(
    session: AsyncSession, redis: Redis, organization_id: UUID
) -> Sequence[Reducer]:
    key = get_cache_key(organization_id)
    reducers: Sequence[Reducer] | None = None
    repository = ReducerRepository.from_session(session)
    try:
        cached = await redis.get(key)
        if cached:
            return [
                Reducer(
                    id=reducer.id,
                    organization_id=reducer.organization_id,
                    filter=reducer.filter,
                    aggregation=reducer.aggregation,
                )
                for reducer in cached_reducers_adapter.validate_json(cached)
            ]
        async with redis.pipeline() as pipeline:
            await pipeline.watch(key)
            reducers = await repository.get_all_active_by_organization(organization_id)
            cached_reducers = [
                CachedReducer.model_validate(reducer) for reducer in reducers
            ]
            pipeline.multi()
            pipeline.set(
                key,
                cached_reducers_adapter.dump_json(cached_reducers),
                ex=REDUCERS_CACHE_TTL_SECONDS,
            )
            await pipeline.execute()
    except WatchError:
        pass
    except RedisError, ValueError:
        log.exception(
            "Failed to cache active reducers", organization_id=organization_id
        )
    if reducers is None:
        reducers = await repository.get_all_active_by_organization(organization_id)
    return reducers
