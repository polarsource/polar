import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fakeredis import FakeAsyncRedis

from polar.worker._debounce import (
    DebounceContext,
    check_debounce,
    finalize_debounce,
    now_timestamp,
    set_debounce_key,
)


def make_actor(**options: object) -> MagicMock:
    actor = MagicMock()
    actor.options = options
    actor.queue_name = "low_priority"
    actor.actor_name = "dummy"
    return actor


@pytest.fixture
def fake_redis() -> FakeAsyncRedis:
    return FakeAsyncRedis(decode_responses=True)


@pytest.fixture
def redis() -> AsyncMock:
    pipe = AsyncMock()
    pipe.__aenter__ = AsyncMock(return_value=pipe)
    pipe.__aexit__ = AsyncMock(return_value=False)

    mock = AsyncMock()
    mock.pipeline = MagicMock(return_value=pipe)
    return mock


@pytest.mark.asyncio
class TestSetDebounceKey:
    async def test_no_debounce_key_factory(self, redis: AsyncMock) -> None:
        """Actor without debounce_key option returns None immediately."""
        actor = make_actor()

        result = await set_debounce_key(redis, actor, "msg-1", (), {})

        assert result is None
        redis.pipeline.assert_not_called()

    async def test_factory_returns_none_skips_debounce(self, redis: AsyncMock) -> None:
        """When the debounce_key factory returns None, skip debouncing entirely."""

        def selective_key(kind: str, item_id: uuid.UUID) -> str | None:
            if kind != "debounce_me":
                return None
            return f"test:{kind}:{item_id}"

        actor = make_actor(debounce_key=selective_key)
        item_id = uuid.uuid4()

        result = await set_debounce_key(
            redis, actor, "msg-1", ("other_kind", item_id), {}
        )

        assert result is None
        redis.pipeline.assert_not_called()

    async def test_factory_returns_key_sets_debounce(self, redis: AsyncMock) -> None:
        """When the factory returns a key, Redis state is set and delay is returned."""

        def selective_key(kind: str, item_id: uuid.UUID) -> str | None:
            if kind != "debounce_me":
                return None
            return f"test:{kind}:{item_id}"

        actor = make_actor(debounce_key=selective_key, debounce_min_threshold=2)
        item_id = uuid.uuid4()

        result = await set_debounce_key(
            redis, actor, "msg-1", ("debounce_me", item_id), {}
        )

        assert result is not None
        key, delay = result
        assert key == f"debounce:test:debounce_me:{item_id}"
        assert delay == 2000  # 2 seconds * 1000ms
        redis.pipeline.assert_called_once()


@pytest.mark.asyncio
class TestCheckDebounce:
    async def test_missing_hash_runs(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor()

        context = await check_debounce(fake_redis, actor, "msg-1", "debounce:test:key")

        assert context == DebounceContext(
            debounce_key="debounce:test:key", enqueue_timestamp=None
        )

    async def test_executed_skips(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor(debounce_key=lambda: "test:key")
        debounce = await set_debounce_key(fake_redis, actor, "owner", (), {})
        assert debounce is not None
        key, _ = debounce
        await fake_redis.hset(key, "executed", 1)

        assert await check_debounce(fake_redis, actor, "owner", key) is None

    async def test_owner_runs(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor(debounce_key=lambda: "test:key")
        debounce = await set_debounce_key(fake_redis, actor, "owner", (), {})
        assert debounce is not None
        key, _ = debounce

        context = await check_debounce(fake_redis, actor, "owner", key)

        assert context is not None
        assert context.enqueue_timestamp is not None
        assert not context.max_threshold_execution

    async def test_non_owner_skips(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor(debounce_key=lambda: "test:key")
        debounce = await set_debounce_key(fake_redis, actor, "owner", (), {})
        assert debounce is not None
        key, _ = debounce

        assert await check_debounce(fake_redis, actor, "other", key) is None

    async def test_non_owner_past_max_threshold_runs(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_max_threshold=5)
        debounce = await set_debounce_key(fake_redis, actor, "owner", (), {})
        assert debounce is not None
        key, _ = debounce
        await fake_redis.hset(key, "enqueue_timestamp", now_timestamp() - 10)

        context = await check_debounce(fake_redis, actor, "other", key)

        assert context is not None
        assert context.max_threshold_execution


@pytest.mark.asyncio
class TestFinalizeDebounce:
    async def test_success_marks_executed(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor(debounce_key=lambda: "test:key")
        debounce = await set_debounce_key(fake_redis, actor, "owner", (), {})
        assert debounce is not None
        key, _ = debounce
        context = await check_debounce(fake_redis, actor, "owner", key)
        assert context is not None

        await finalize_debounce(fake_redis, actor, context, None)

        assert await fake_redis.hget(key, "executed") == "1"
        assert not await fake_redis.hexists(key, "enqueue_timestamp")
        assert await fake_redis.ttl(key) > 0

    async def test_exception_does_not_mark_executed(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key")
        debounce = await set_debounce_key(fake_redis, actor, "owner", (), {})
        assert debounce is not None
        key, _ = debounce
        context = await check_debounce(fake_redis, actor, "owner", key)
        assert context is not None

        await finalize_debounce(fake_redis, actor, context, ValueError("boom"))

        assert await fake_redis.hget(key, "executed") == "0"
        assert await fake_redis.hexists(key, "enqueue_timestamp")

    async def test_max_threshold_execution_bumps_window_even_on_failure(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_max_threshold=5)
        debounce = await set_debounce_key(fake_redis, actor, "owner", (), {})
        assert debounce is not None
        key, _ = debounce
        old_timestamp = now_timestamp() - 10
        await fake_redis.hset(key, "enqueue_timestamp", old_timestamp)
        context = await check_debounce(fake_redis, actor, "other", key)
        assert context is not None

        await finalize_debounce(fake_redis, actor, context, ValueError("boom"))

        bumped_timestamp = await fake_redis.hget(key, "enqueue_timestamp")
        assert bumped_timestamp is not None
        assert int(bumped_timestamp) > old_timestamp
        assert await fake_redis.hget(key, "executed") == "0"
        assert await fake_redis.ttl(key) > 0

    async def test_expired_hash_leaves_no_key(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor()
        context = DebounceContext(
            debounce_key="debounce:test:key", enqueue_timestamp=None
        )

        await finalize_debounce(fake_redis, actor, context, None)

        assert await fake_redis.exists("debounce:test:key") == 0
