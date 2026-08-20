import asyncio

import dramatiq
import pytest
from dramatiq.errors import Retry
from logfire.testing import CaptureLogfire
from opentelemetry.sdk.trace import ReadableSpan
from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
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
