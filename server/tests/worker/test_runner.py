import pytest
from dramatiq.errors import Retry
from logfire.testing import CaptureLogfire
from opentelemetry.sdk.trace import ReadableSpan
from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.worker._runner import run_task


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
