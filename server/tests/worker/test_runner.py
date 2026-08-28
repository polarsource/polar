import asyncio
import datetime
import time
from unittest.mock import AsyncMock

import dramatiq
import pytest
from dramatiq.errors import Retry
from dramatiq.middleware.group_callbacks import GroupCallbacks
from fakeredis import FakeAsyncRedis
from logfire.testing import CaptureLogfire
from opentelemetry.sdk.trace import ReadableSpan
from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.worker import get_message_timestamp
from polar.worker._debounce import now_timestamp
from polar.worker._runner import TaskTimeoutError, run_task


def _task_spans(capfire: CaptureLogfire) -> list[ReadableSpan]:
    return [
        span
        for span in capfire.exporter.exported_spans
        if span.name == "TASK {actor}"
        and span.attributes is not None
        and span.attributes.get("logfire.span_type") == "span"
    ]


@pytest.mark.asyncio
class TestRunTask:
    @pytest.mark.parametrize(
        "exception",
        [
            pytest.param(Retry(delay=1000), id="retry"),
            pytest.param(ValueError("boom"), id="exception"),
        ],
    )
    async def test_failure_does_not_notify_group_completion(
        self, exception: Exception, mocker: MockerFixture
    ) -> None:
        async def raising_task() -> None:
            raise exception

        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": raising_task},
        )
        group_callbacks = next(
            middleware
            for middleware in dramatiq.get_broker().middleware
            if isinstance(middleware, GroupCallbacks)
        )
        after_process_message = mocker.patch.object(
            group_callbacks, "after_process_message"
        )

        with pytest.raises(type(exception)):
            await run_task(
                "dummy",
                message_options={
                    "group_completion_uuid": "group-1",
                    "group_completion_callbacks": [],
                },
            )

        after_process_message.assert_not_called()

    async def test_retry_not_recorded_as_span_error(
        self, capfire: CaptureLogfire, mocker: MockerFixture
    ) -> None:
        async def raising_task() -> None:
            raise Retry(delay=1000)

        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": raising_task},
        )

        with pytest.raises(Retry):
            await run_task("dummy")

        spans = _task_spans(capfire)
        assert len(spans) == 1
        assert not spans[0].events
        assert spans[0].attributes is not None
        assert "logfire.level_num" not in spans[0].attributes

    async def test_exception_recorded_as_span_error(
        self, capfire: CaptureLogfire, mocker: MockerFixture
    ) -> None:
        async def raising_task() -> None:
            raise ValueError("boom")

        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": raising_task},
        )

        with pytest.raises(ValueError, match="boom"):
            await run_task("dummy")

        spans = _task_spans(capfire)
        assert len(spans) == 1
        assert any(event.name == "exception" for event in spans[0].events)

    async def test_time_limit_exceeded(self, mocker: MockerFixture) -> None:
        async def slow_task() -> None:
            await asyncio.sleep(10)

        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": slow_task},
        )
        mocker.patch.dict(
            dramatiq.get_broker().get_actor("dummy").options, {"time_limit": 100}
        )

        with pytest.raises(TaskTimeoutError, match="dummy"):
            await run_task("dummy")

    async def test_remaining_time_bounds_time_limit(
        self, mocker: MockerFixture
    ) -> None:
        async def slow_task() -> None:
            await asyncio.sleep(10)

        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": slow_task},
        )

        with pytest.raises(TaskTimeoutError):
            await run_task("dummy", remaining_time_seconds=0.1)

    async def test_completes_within_time_limit(self, mocker: MockerFixture) -> None:
        async def fast_task() -> None:
            await asyncio.sleep(0)

        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": fast_task},
        )

        await run_task("dummy", remaining_time_seconds=30)

    async def test_task_raised_timeout_error_not_converted(
        self, mocker: MockerFixture
    ) -> None:
        async def raising_task() -> None:
            raise TimeoutError("upstream timed out")

        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": raising_task},
        )

        with pytest.raises(TimeoutError, match="upstream timed out"):
            await run_task("dummy")

    async def test_message_timestamp_reflects_enqueue_time(
        self, mocker: MockerFixture
    ) -> None:
        seen: list[datetime.datetime] = []

        async def recording_task() -> None:
            seen.append(get_message_timestamp())

        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": recording_task},
        )

        await run_task("dummy", message_timestamp=1234567890000)

        assert seen == [datetime.datetime.fromtimestamp(1234567890, tz=datetime.UTC)]


@pytest.mark.asyncio
class TestRunTaskAgeLimit:
    async def test_stale_message_skipped(self, mocker: MockerFixture) -> None:
        task = mocker.AsyncMock()
        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"meter.enqueue_billing": task},
        )

        await run_task(
            "meter.enqueue_billing",
            message_timestamp=int(time.time() * 1000) - 6 * 60 * 1000,
        )

        task.assert_not_called()

    async def test_fresh_message_runs(self, mocker: MockerFixture) -> None:
        task = mocker.AsyncMock()
        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"meter.enqueue_billing": task},
        )

        await run_task(
            "meter.enqueue_billing", message_timestamp=int(time.time() * 1000)
        )

        task.assert_called_once()

    async def test_missing_timestamp_runs(self, mocker: MockerFixture) -> None:
        task = mocker.AsyncMock()
        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"meter.enqueue_billing": task},
        )

        await run_task("meter.enqueue_billing")

        task.assert_called_once()

    async def test_actor_without_max_age_runs(self, mocker: MockerFixture) -> None:
        task = mocker.AsyncMock()
        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": task},
        )

        await run_task("dummy", message_timestamp=1234567890000)

        task.assert_called_once()


@pytest.mark.asyncio
class TestRunTaskDebounce:
    DEBOUNCE_KEY = "debounce:dummy:key"

    @pytest.fixture
    def fake_redis(self, mocker: MockerFixture) -> FakeAsyncRedis:
        fake_redis = FakeAsyncRedis(decode_responses=True)
        mocker.patch(
            "polar.worker._runner.RedisMiddleware.get", return_value=fake_redis
        )
        return fake_redis

    @pytest.fixture
    def task_fn(self, mocker: MockerFixture) -> AsyncMock:
        task_fn = AsyncMock()
        mocker.patch(
            "polar.worker._runner.build_registry", return_value={"dummy": task_fn}
        )
        return task_fn

    async def test_executed_key_skips_task(
        self, fake_redis: FakeAsyncRedis, task_fn: AsyncMock
    ) -> None:
        await fake_redis.hset(
            self.DEBOUNCE_KEY,
            mapping={
                "enqueue_timestamp": now_timestamp(),
                "message_id": "owner",
                "executed": 1,
            },
        )

        await run_task("dummy", message_id="owner", debounce_key=self.DEBOUNCE_KEY)

        task_fn.assert_not_awaited()

    async def test_owner_runs_and_marks_executed(
        self, fake_redis: FakeAsyncRedis, task_fn: AsyncMock
    ) -> None:
        await fake_redis.hset(
            self.DEBOUNCE_KEY,
            mapping={
                "enqueue_timestamp": now_timestamp(),
                "message_id": "owner",
                "executed": 0,
            },
        )

        await run_task("dummy", message_id="owner", debounce_key=self.DEBOUNCE_KEY)

        task_fn.assert_awaited_once()
        assert await fake_redis.hget(self.DEBOUNCE_KEY, "executed") == "1"

    async def test_retry_does_not_mark_executed(
        self, fake_redis: FakeAsyncRedis, task_fn: AsyncMock
    ) -> None:
        task_fn.side_effect = Retry(delay=1000)
        await fake_redis.hset(
            self.DEBOUNCE_KEY,
            mapping={
                "enqueue_timestamp": now_timestamp(),
                "message_id": "owner",
                "executed": 0,
            },
        )

        with pytest.raises(Retry):
            await run_task("dummy", message_id="owner", debounce_key=self.DEBOUNCE_KEY)

        assert await fake_redis.hget(self.DEBOUNCE_KEY, "executed") == "0"

    async def test_exception_does_not_mark_executed(
        self, fake_redis: FakeAsyncRedis, task_fn: AsyncMock
    ) -> None:
        task_fn.side_effect = ValueError("boom")
        await fake_redis.hset(
            self.DEBOUNCE_KEY,
            mapping={
                "enqueue_timestamp": now_timestamp(),
                "message_id": "owner",
                "executed": 0,
            },
        )

        with pytest.raises(ValueError, match="boom"):
            await run_task("dummy", message_id="owner", debounce_key=self.DEBOUNCE_KEY)

        assert await fake_redis.hget(self.DEBOUNCE_KEY, "executed") == "0"
