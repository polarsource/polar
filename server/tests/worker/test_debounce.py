import uuid
from unittest.mock import MagicMock

import pytest
from dramatiq.middleware import SkipMessage
from fakeredis import FakeAsyncRedis, FakeRedis
from pytest_mock import MockerFixture
from redis import ConnectionPool

from polar.worker._debounce import (
    DebounceContext,
    DebounceMiddleware,
    DebounceReschedule,
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


class TestSetDebounceKey:
    def test_no_debounce_key_factory(self) -> None:
        """Actor without debounce_key option returns None immediately."""
        actor = make_actor()
        pipeline = MagicMock()

        result = set_debounce_key(pipeline, actor, "msg-1", (), {})

        assert result is None
        pipeline.eval.assert_not_called()

    def test_factory_returns_none_skips_debounce(self) -> None:
        """When the debounce_key factory returns None, skip debouncing entirely."""

        def selective_key(kind: str, item_id: uuid.UUID) -> str | None:
            if kind != "debounce_me":
                return None
            return f"test:{kind}:{item_id}"

        actor = make_actor(debounce_key=selective_key)
        item_id = uuid.uuid4()
        pipeline = MagicMock()

        result = set_debounce_key(pipeline, actor, "msg-1", ("other_kind", item_id), {})

        assert result is None
        pipeline.eval.assert_not_called()

    def test_factory_returns_key_sets_debounce(self) -> None:
        """When the factory returns a key, Redis state is set and delay is returned."""

        def selective_key(kind: str, item_id: uuid.UUID) -> str | None:
            if kind != "debounce_me":
                return None
            return f"test:{kind}:{item_id}"

        actor = make_actor(debounce_key=selective_key, debounce_min_threshold=2)
        item_id = uuid.uuid4()
        pipeline = MagicMock()

        result = set_debounce_key(
            pipeline, actor, "msg-1", ("debounce_me", item_id), {}
        )

        assert result is not None
        key, delay = result
        assert key == f"debounce:test:debounce_me:{item_id}"
        assert delay == 2000  # 2 seconds * 1000ms
        pipeline.eval.assert_called_once()


@pytest.mark.anyio
class TestCheckDebounce:
    async def test_missing_hash_runs(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor()

        context = await check_debounce(fake_redis, actor, "msg-1", "debounce:test:key")

        assert context == DebounceContext(
            debounce_key="debounce:test:key", message_id="msg-1", enqueue_timestamp=None
        )

    async def test_executed_skips(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_min_threshold=0)
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "owner", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce
        await fake_redis.hset(key, "executed", 1)

        assert await check_debounce(fake_redis, actor, "owner", key) is None

    async def test_owner_runs(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_min_threshold=0)
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "owner", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce

        context = await check_debounce(fake_redis, actor, "owner", key)

        assert isinstance(context, DebounceContext)
        assert context.enqueue_timestamp is not None
        assert await fake_redis.hget(key, "started") == "owner"

    async def test_non_owner_skips(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_min_threshold=0)
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "owner", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce

        assert await check_debounce(fake_redis, actor, "other", key) is None

    async def test_owner_reschedules_while_enqueues_continue(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_min_threshold=10)
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "owner", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce

        reschedule = await check_debounce(fake_redis, actor, "owner", key)

        assert isinstance(reschedule, DebounceReschedule)
        assert 9000 <= reschedule.delay <= 10000
        assert await fake_redis.hget(key, "message_id") == reschedule.message_id

    async def test_reschedule_is_capped_by_max_threshold(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(
            debounce_key=lambda: "test:key",
            debounce_min_threshold=10,
            debounce_max_threshold=10,
        )
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "owner", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce
        await fake_redis.hset(key, "enqueue_timestamp", now_timestamp() - 8)

        reschedule = await check_debounce(fake_redis, actor, "owner", key)

        assert isinstance(reschedule, DebounceReschedule)
        assert reschedule.delay <= 2000

    async def test_owner_past_max_threshold_runs(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(
            debounce_key=lambda: "test:key",
            debounce_min_threshold=10,
            debounce_max_threshold=5,
        )
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "owner", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce
        await fake_redis.hset(key, "enqueue_timestamp", now_timestamp() - 10)

        context = await check_debounce(fake_redis, actor, "owner", key)

        assert isinstance(context, DebounceContext)

    async def test_retry_of_started_owner_runs(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_min_threshold=0)
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "owner", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce
        await check_debounce(fake_redis, actor, "owner", key)

        context = await check_debounce(fake_redis, actor, "owner", key)

        assert isinstance(context, DebounceContext)


@pytest.mark.anyio
class TestSetDebounceKeyClaim:
    async def test_waiting_message_is_not_sent(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key")
        async with fake_redis.pipeline() as pipeline:
            set_debounce_key(pipeline, actor, "first", (), {})
            set_debounce_key(pipeline, actor, "second", (), {})
            claims = await pipeline.execute()

        assert claims == [1, 0]
        assert await fake_redis.hget("debounce:test:key", "message_id") == "first"

    async def test_skip_does_not_refresh_ttl(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor(debounce_key=lambda: "test:key")
        async with fake_redis.pipeline() as pipeline:
            set_debounce_key(pipeline, actor, "first", (), {})
            pipeline.expire("debounce:test:key", 100)
            set_debounce_key(pipeline, actor, "second", (), {})
            await pipeline.execute()

        assert await fake_redis.ttl("debounce:test:key") <= 100

    async def test_started_message_gets_one_successor(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_min_threshold=0)
        async with fake_redis.pipeline() as pipeline:
            set_debounce_key(pipeline, actor, "first", (), {})
            await pipeline.execute()
        await check_debounce(fake_redis, actor, "first", "debounce:test:key")

        async with fake_redis.pipeline() as pipeline:
            set_debounce_key(pipeline, actor, "second", (), {})
            set_debounce_key(pipeline, actor, "third", (), {})
            claims = await pipeline.execute()

        assert claims == [1, 0]


@pytest.mark.anyio
class TestFinalizeDebounce:
    async def test_success_marks_executed(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_min_threshold=0)
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "owner", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce
        context = await check_debounce(fake_redis, actor, "owner", key)
        assert isinstance(context, DebounceContext)

        await finalize_debounce(fake_redis, actor, context, None)

        assert await fake_redis.hget(key, "executed") == "1"
        assert not await fake_redis.hexists(key, "enqueue_timestamp")
        assert await fake_redis.ttl(key) > 0

    async def test_exception_does_not_mark_executed(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_min_threshold=0)
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "owner", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce
        context = await check_debounce(fake_redis, actor, "owner", key)
        assert isinstance(context, DebounceContext)

        await finalize_debounce(fake_redis, actor, context, ValueError("boom"))

        assert await fake_redis.hget(key, "executed") == "0"

    async def test_newer_enqueue_during_run_still_executes(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key", debounce_min_threshold=0)
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(pipeline, actor, "first", (), {})
            await pipeline.execute()
        assert debounce is not None
        key, _ = debounce
        context = await check_debounce(fake_redis, actor, "first", key)
        assert isinstance(context, DebounceContext)

        async with fake_redis.pipeline() as pipeline:
            set_debounce_key(pipeline, actor, "second", (), {})
            await pipeline.execute()
        await finalize_debounce(fake_redis, actor, context, None)

        assert await check_debounce(fake_redis, actor, "second", key) is not None

    async def test_expired_hash_leaves_no_key(self, fake_redis: FakeAsyncRedis) -> None:
        actor = make_actor()
        context = DebounceContext(
            debounce_key="debounce:test:key", message_id="owner", enqueue_timestamp=None
        )

        await finalize_debounce(fake_redis, actor, context, None)

        assert await fake_redis.exists("debounce:test:key") == 0


class TestDebounceMiddlewareBeforeProcessMessage:
    def test_reschedules_while_enqueues_continue(self, mocker: MockerFixture) -> None:
        sync_redis = FakeRedis()
        middleware = DebounceMiddleware(ConnectionPool())
        mocker.patch.object(middleware, "_redis", sync_redis)
        key = "debounce:test:key"
        sync_redis.hset(
            key,
            mapping={
                "message_id": "owner",
                "executed": 0,
                "enqueue_timestamp": now_timestamp(),
                "last_enqueue_timestamp": now_timestamp(),
            },
        )
        broker = MagicMock()
        broker.get_actor.return_value = make_actor(debounce_min_threshold=10)
        message = MagicMock(message_id="owner", options={"debounce_key": key})

        with pytest.raises(SkipMessage):
            middleware.before_process_message(broker, message)

        rescheduled_message_id = sync_redis.hget(key, "message_id")
        assert rescheduled_message_id is not None
        message.copy.assert_called_once_with(message_id=rescheduled_message_id.decode())
        assert 9000 <= broker.enqueue.call_args.kwargs["delay"] <= 10000


class TestDebounceMiddlewareAfterProcessMessage:
    def test_newer_enqueue_during_run_still_executes(
        self, mocker: MockerFixture
    ) -> None:
        sync_redis = FakeRedis()
        middleware = DebounceMiddleware(ConnectionPool())
        mocker.patch.object(middleware, "_redis", sync_redis)
        key = "debounce:test:key"
        sync_redis.hset(
            key,
            mapping={
                "message_id": "second",
                "executed": 0,
                "enqueue_timestamp": now_timestamp(),
            },
        )
        message = MagicMock(
            message_id="first",
            options={"debounce_key": key, "debounce_enqueue_timestamp": None},
        )

        middleware.after_process_message(MagicMock(), message, exception=None)

        assert sync_redis.hget(key, "executed") == b"0"
