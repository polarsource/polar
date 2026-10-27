from collections.abc import Sequence
from uuid import UUID

import pytest
from pytest_mock import MockerFixture
from redis.exceptions import RedisError

from polar.kit.utils import utc_now
from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.meter.repository import MeterRepository
from polar.models import Meter, Organization, Reducer
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.reducer import cache
from polar.reducer.repository import ReducerRepository
from polar.reducer.tasks import invalidate_cache
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_reducer


@pytest.mark.anyio
class TestGetActiveReducers:
    @pytest.mark.parametrize(
        "aggregation",
        [
            CountAggregation(),
            PropertyAggregation(func=AggregationFunction.sum, property="tokens"),
            UniqueAggregation(func=AggregationFunction.unique, property="tokens"),
        ],
    )
    async def test_cache_hit(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
        meter: Meter,
        aggregation: Aggregation,
    ) -> None:
        meter.aggregation = aggregation
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        query = mocker.spy(ReducerRepository, "get_all_active_by_organization")

        await cache.get_active_reducers(session, redis, organization.id)
        [cached] = await cache.get_active_reducers(session, redis, organization.id)

        assert query.call_count == 1
        assert cached.id == reducer.id
        assert cached.organization_id == organization.id
        assert cached.filter == meter.filter
        assert cached.aggregation == aggregation
        assert (
            0
            < await redis.ttl(cache.get_cache_key(organization.id))
            <= cache.REDUCERS_CACHE_TTL_SECONDS
        )

    async def test_empty_cache_and_organization_invalidation(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
        organization_second: Organization,
        meter: Meter,
    ) -> None:
        query = mocker.spy(ReducerRepository, "get_all_active_by_organization")
        for org in (organization, organization_second):
            assert await cache.get_active_reducers(session, redis, org.id) == []
            assert await cache.get_active_reducers(session, redis, org.id) == []
        assert query.call_count == 2

        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        await invalidate_cache(organization.id)
        [cached] = await cache.get_active_reducers(session, redis, organization.id)
        assert cached.id == reducer.id
        assert (
            await cache.get_active_reducers(session, redis, organization_second.id)
            == []
        )
        assert query.call_count == 3

        await MeterRepository.from_session(session).update(
            meter, update_dict={"archived_at": utc_now()}
        )
        await invalidate_cache(organization.id)
        assert await cache.get_active_reducers(session, redis, organization.id) == []

        await MeterRepository.from_session(session).update(
            meter, update_dict={"archived_at": None}
        )
        await invalidate_cache(organization.id)
        [cached] = await cache.get_active_reducers(session, redis, organization.id)
        assert cached.id == reducer.id

    @pytest.mark.parametrize("failure", ["get", "set", "invalid_json"])
    async def test_cache_failure_uses_database(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        organization: Organization,
        meter: Meter,
        failure: str,
    ) -> None:
        reducer = await create_reducer(
            save_fixture, organization=organization, meters=[meter]
        )
        query = mocker.spy(ReducerRepository, "get_all_active_by_organization")
        if failure == "get":
            mocker.patch.object(redis, "get", side_effect=RedisError)
        elif failure == "set":
            mocker.patch(
                "redis.asyncio.client.Pipeline.execute", side_effect=RedisError
            )
        else:
            await redis.set(cache.get_cache_key(organization.id), "invalid")

        [cached] = await cache.get_active_reducers(session, redis, organization.id)
        assert cached.id == reducer.id
        assert query.call_count == 1

    async def test_invalidation_during_cache_fill(
        self,
        session: AsyncSession,
        redis: Redis,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        async def query_then_invalidate(
            repository: ReducerRepository, organization_id: UUID
        ) -> Sequence[Reducer]:
            await cache.invalidate(redis, organization_id)
            return []

        query = mocker.patch.object(
            ReducerRepository,
            "get_all_active_by_organization",
            autospec=True,
            side_effect=query_then_invalidate,
        )
        assert await cache.get_active_reducers(session, redis, organization.id) == []
        assert await cache.get_active_reducers(session, redis, organization.id) == []
        assert query.call_count == 2
