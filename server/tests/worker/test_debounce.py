import uuid
from unittest.mock import MagicMock

import dramatiq
import pytest
from dramatiq.middleware import SkipMessage
from fakeredis import FakeAsyncRedis, FakeRedis
from pytest_mock import MockerFixture
from redis import ConnectionPool

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.config import settings
from polar.logging import CorrelationID
from polar.models.webhook_endpoint import WebhookEventType
from polar.worker import JobQueueManager
from polar.worker._debounce import (
    DebounceContext,
    DebounceMiddleware,
    DebounceReschedule,
    check_debounce,
    finalize_debounce,
    hand_over_debounce,
    now_timestamp,
    set_debounce_key,
)
from polar.worker._runner import run_task
from polar.worker._sqs import Job


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
        assert await fake_redis.hget(key, "message_id") == "owner"

        await hand_over_debounce(fake_redis, key, "owner", reschedule)

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

    async def test_lost_waiting_message_gets_successor(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key")
        async with fake_redis.pipeline() as pipeline:
            set_debounce_key(pipeline, actor, "first", (), {})
            await pipeline.execute()
        await fake_redis.hset(
            "debounce:test:key", "due_timestamp", now_timestamp() - 3600
        )

        async with fake_redis.pipeline() as pipeline:
            set_debounce_key(pipeline, actor, "second", (), {})
            claims = await pipeline.execute()

        assert claims == [1]
        assert await fake_redis.hget("debounce:test:key", "message_id") == "second"

    async def test_explicit_delay_sets_due_time(
        self, fake_redis: FakeAsyncRedis
    ) -> None:
        actor = make_actor(debounce_key=lambda: "test:key")
        before = now_timestamp()
        async with fake_redis.pipeline() as pipeline:
            debounce = set_debounce_key(
                pipeline, actor, "first", (), {}, delay=3600 * 1000
            )
            await pipeline.execute()

        assert debounce == ("debounce:test:key", 3600 * 1000)
        due_timestamp = await fake_redis.hget("debounce:test:key", "due_timestamp")
        assert due_timestamp is not None
        assert int(due_timestamp) >= before + 3600

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


class FakeSQS:
    """Delivers the jobs sent by enqueues and reschedules once their delay passed, on
    a fake clock that also drives the debounce timestamps."""

    def __init__(self, mocker: MockerFixture, redis: FakeAsyncRedis) -> None:
        self.redis = redis
        self.now = 1_000_000
        self.queue: list[tuple[int, Job]] = []
        self.sent = 0
        self.runs: list[int] = []
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", True)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {"customer.webhook"})
        mocker.patch(
            "polar.worker._debounce.now_timestamp", side_effect=lambda: self.now
        )
        mocker.patch("polar.worker._runner.RedisMiddleware.get", return_value=redis)
        mocker.patch("polar.worker._enqueue._sqs.send_jobs", self.send_jobs)
        mocker.patch("polar.worker._runner._sqs.send_jobs", self.send_jobs)
        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"customer.webhook": self.task},
        )

    async def send_jobs(self, jobs: list[Job]) -> None:
        self.sent += len(jobs)
        self.queue += [(self.now + (job.delay or 0) // 1000, job) for job in jobs]

    async def task(self, *args: object) -> None:
        self.runs.append(self.now)

    async def enqueue(self, customer_id: uuid.UUID) -> None:
        jqm = JobQueueManager()
        jqm.enqueue_job(
            "customer.webhook", WebhookEventType.customer_state_changed, customer_id
        )
        await jqm.flush(dramatiq.get_broker(), self.redis)

    async def advance_to(self, now: int) -> None:
        self.now = now
        due = [job for due_at, job in self.queue if due_at <= now]
        self.queue = [(due_at, job) for due_at, job in self.queue if due_at > now]
        for job in due:
            await run_task(
                job.actor,
                job.args,
                job.kwargs,
                message_id=job.message_id,
                debounce_key=job.debounce_key,
            )


@pytest.mark.anyio
class TestEndToEnd:
    """customer.webhook debounces with a 1s min and a 5s max threshold."""

    @pytest.fixture
    def sqs(self, mocker: MockerFixture, fake_redis: FakeAsyncRedis) -> FakeSQS:
        CorrelationID.set()
        return FakeSQS(mocker, fake_redis)

    async def test_burst_runs_once_after_quiet_period(self, sqs: FakeSQS) -> None:
        customer_id = uuid.uuid4()
        start = sqs.now
        await sqs.enqueue(customer_id)
        await sqs.enqueue(customer_id)
        sqs.now = start + 1
        await sqs.enqueue(customer_id)
        for second in range(1, 10):
            await sqs.advance_to(start + second)

        assert sqs.runs == [start + 2]
        assert sqs.sent == 2

    async def test_steady_stream_runs_at_max_threshold(self, sqs: FakeSQS) -> None:
        customer_id = uuid.uuid4()
        start = sqs.now
        for second in range(12):
            sqs.now = start + second
            await sqs.enqueue(customer_id)
            await sqs.advance_to(start + second)
        await sqs.advance_to(start + 20)

        assert sqs.runs == [start + 5, start + 11]
        assert sqs.sent == 10

    async def test_enqueue_after_run_starts_new_window(self, sqs: FakeSQS) -> None:
        customer_id = uuid.uuid4()
        start = sqs.now
        await sqs.enqueue(customer_id)
        await sqs.advance_to(start + 1)
        await sqs.enqueue(customer_id)
        await sqs.advance_to(start + 2)

        assert sqs.runs == [start + 1, start + 2]

    async def test_lost_message_recovers_on_next_enqueue(self, sqs: FakeSQS) -> None:
        customer_id = uuid.uuid4()
        start = sqs.now
        await sqs.enqueue(customer_id)
        sqs.queue.clear()
        await sqs.advance_to(start + 60)
        await sqs.enqueue(customer_id)
        await sqs.advance_to(start + 61)

        assert sqs.runs == []

        await sqs.advance_to(start + 400)
        await sqs.enqueue(customer_id)
        await sqs.advance_to(start + 401)

        assert sqs.runs == [start + 401]
