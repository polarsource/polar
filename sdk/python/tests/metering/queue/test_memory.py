import time
from unittest.mock import AsyncMock

import anyio
import anyio.lowlevel
import pytest

from polar.metering import EventQueue, MeteringDeliveryError, MeteringTimeoutError
from polar.metering.errors import IngestRejectedError, IngestRetryableError
from polar.metering.events import EventInput
from polar.metering.queue.memory import DropReason, MemoryEventQueue, _FlushRequest


@pytest.fixture
def ingest() -> AsyncMock:
    return AsyncMock(return_value=None)


@pytest.fixture
def events() -> list[EventInput]:
    return [
        {"name": str(index), "external_customer_id": "customer"} for index in range(5)
    ]


@pytest.mark.anyio
async def test_flush_drains_batches_and_keeps_accepting_events(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    strategy: EventQueue = MemoryEventQueue(batch_size=2, batch_interval=60)
    with pytest.raises(RuntimeError, match="inside an open"):
        await strategy.flush()
    with pytest.raises(RuntimeError, match="inside an open"):
        await strategy.enqueue(events[0])
    with anyio.fail_after(1):
        async with strategy.open(ingest=ingest):
            with pytest.raises(RuntimeError, match="already started"):
                async with strategy.open(ingest=ingest):
                    pass
            await strategy.flush()
            ingest.assert_not_awaited()
            for event in events:
                await strategy.enqueue(event)
            await strategy.flush()
            batches = [call.args[0] for call in ingest.await_args_list]
            assert batches == [events[:2], events[2:4], events[4:]]
            ingest.reset_mock()
            await strategy.enqueue(events[0])
            await strategy.flush()
            ingest.assert_awaited_once_with(events[:1])
    with pytest.raises(RuntimeError, match="inside an open"):
        await strategy.flush()
    with pytest.raises(RuntimeError, match="inside an open"):
        await strategy.enqueue(events[0])


@pytest.mark.anyio
@pytest.mark.parametrize("batch_size, batch_interval", [(1, 60), (100, 0.01), (100, 0)])
async def test_batching_without_explicit_flush(
    ingest: AsyncMock, events: list[EventInput], batch_size: int, batch_interval: float
) -> None:
    sent = anyio.Event()
    ingest.side_effect = lambda events: sent.set()
    with anyio.fail_after(1):
        async with MemoryEventQueue(
            batch_size=batch_size, batch_interval=batch_interval
        ).open(ingest=ingest) as strategy:
            await strategy.enqueue(events[0])
            await sent.wait()
            ingest.assert_awaited_once_with(events[:1])


@pytest.mark.anyio
async def test_the_newest_flush_keeps_its_boundary(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    release = [anyio.Event() for _ in range(3)]
    completed = [anyio.Event(), anyio.Event()]

    async def send(events: list[EventInput]) -> None:
        await release[int(events[0]["name"])].wait()

    async def flush(index: int) -> None:
        await strategy.flush()
        completed[index].set()

    ingest.side_effect = send
    with anyio.fail_after(1):
        async with (
            MemoryEventQueue(batch_size=1).open(ingest=ingest) as strategy,
            anyio.create_task_group() as callers,
        ):
            for index in range(2):
                await strategy.enqueue(events[index])
                callers.start_soon(flush, index)
                await anyio.wait_all_tasks_blocked()
            await strategy.enqueue(events[2])
            assert completed[0].is_set()
            assert not completed[1].is_set()
            release[0].set()
            await anyio.wait_all_tasks_blocked()
            assert not completed[1].is_set()
            release[1].set()
            await completed[1].wait()
            await anyio.wait_all_tasks_blocked()
            assert ingest.await_count == 3
            release[2].set()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "batch_size, batches", [(100, [[1, 2, 3]]), (2, [[1, 2], [3]])]
)
async def test_released_flushes_batch_queued_events(
    ingest: AsyncMock,
    events: list[EventInput],
    batch_size: int,
    batches: list[list[int]],
) -> None:
    release: list[anyio.Event] = []
    completed = [anyio.Event() for _ in range(4)]

    async def send(events: list[EventInput]) -> None:
        gate = anyio.Event()
        release.append(gate)
        await gate.wait()

    async def flush(index: int) -> None:
        await strategy.flush()
        completed[index].set()

    ingest.side_effect = send
    with anyio.fail_after(1):
        async with (
            MemoryEventQueue(batch_size=batch_size, batch_interval=60).open(
                ingest=ingest
            ) as strategy,
            anyio.create_task_group() as callers,
        ):
            for index in range(4):
                await strategy.enqueue(events[index])
                callers.start_soon(flush, index)
                await anyio.wait_all_tasks_blocked()
            assert ingest.await_count == 1
            assert [done.is_set() for done in completed] == [True, True, True, False]
            release[0].set()
            for index, batch in enumerate(batches):
                await anyio.wait_all_tasks_blocked()
                assert ingest.await_count == index + 2
                call = ingest.await_args_list[index + 1]
                assert call.args[0] == [events[i] for i in batch]
                assert not completed[3].is_set()
                release[index + 1].set()
            await completed[3].wait()
            await anyio.wait_all_tasks_blocked()
            assert ingest.await_count == len(batches) + 1


@pytest.mark.anyio
async def test_flush_waits_for_retries(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    ingest.side_effect = [IngestRetryableError(retry_after=1), None]
    with anyio.fail_after(3):
        async with MemoryEventQueue(batch_interval=60).open(ingest=ingest) as strategy:
            await strategy.enqueue(events[0])
            await strategy.flush()
            first, second = ingest.await_args_list
            assert first.args[0] == events[:1]
            assert first == second


@pytest.mark.anyio
async def test_retry_after_waits_a_second_without_spending_attempts(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    on_rejected = AsyncMock()
    calls: list[float] = []

    async def send(events: list[EventInput]) -> None:
        calls.append(time.monotonic())
        if len(calls) == 1:
            raise IngestRetryableError(retry_after=1)

    ingest.side_effect = send
    with anyio.fail_after(3):
        async with MemoryEventQueue(batch_interval=60, max_attempts=1).open(
            ingest=ingest, on_rejected=on_rejected
        ) as strategy:
            await strategy.enqueue(events[0])
            await strategy.flush()
            assert len(calls) == 2
            assert calls[1] - calls[0] >= 0.9
            on_rejected.assert_not_awaited()


@pytest.mark.anyio
async def test_retry_after_beyond_budget_drops_the_batch(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    on_rejected = AsyncMock()
    ingest.side_effect = IngestRetryableError(retry_after=301)
    with anyio.fail_after(0.5):
        async with MemoryEventQueue(batch_interval=60, shutdown_timeout=0.02).open(
            ingest=ingest, on_rejected=on_rejected
        ) as strategy:
            await strategy.enqueue(events[0])
            with pytest.raises(MeteringDeliveryError) as failure:
                await strategy.flush()
            assert failure.value.failures[0].cause is ingest.side_effect
            ingest.assert_awaited_once()
            assert failure.value.failures[0].reason == "retry_exhausted"
            on_rejected.assert_not_awaited()


@pytest.mark.anyio
async def test_flush_waits_for_rejection_hook(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    error = IngestRejectedError("invalid")
    reporting = anyio.Event()
    release = anyio.Event()
    completed = anyio.Event()

    async def on_rejected(batch: list[EventInput], drop_reason: DropReason) -> None:
        assert batch == events[:1]
        assert drop_reason == "permanent_error"
        reporting.set()
        await release.wait()

    async def flush() -> None:
        with pytest.raises(MeteringDeliveryError) as failure:
            await strategy.flush()
        assert failure.value.events == events[:1]
        assert failure.value.failures[0].cause is error
        completed.set()

    ingest.side_effect = error
    with anyio.fail_after(1):
        async with (
            MemoryEventQueue(batch_interval=60, max_attempts=1).open(
                ingest=ingest, on_rejected=on_rejected
            ) as strategy,
            anyio.create_task_group() as callers,
        ):
            await strategy.enqueue(events[0])
            callers.start_soon(flush)
            await reporting.wait()
            assert not completed.is_set()
            release.set()
            await completed.wait()
    ingest.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("fail_worker", [False, True])
async def test_worker_exit_releases_the_waiting_flush(
    ingest: AsyncMock, events: list[EventInput], fail_worker: bool
) -> None:
    release = anyio.Event()
    failure = TypeError("broken transport")
    flush_errors: list[MeteringDeliveryError] = []

    async def send(events: list[EventInput]) -> None:
        await release.wait()
        raise failure

    async def flush() -> None:
        with anyio.CancelScope(shield=True):
            try:
                await strategy.flush()
            except MeteringDeliveryError as error:
                flush_errors.append(error)

    ingest.side_effect = send
    on_rejected = AsyncMock()
    strategy = MemoryEventQueue(batch_interval=60, shutdown_timeout=0.02)
    with anyio.fail_after(1):
        async with anyio.create_task_group() as callers:
            with pytest.raises(MeteringDeliveryError):
                async with strategy.open(ingest=ingest, on_rejected=on_rejected):
                    await strategy.enqueue(events[0])
                    for _ in range(2):
                        callers.start_soon(flush)
                        await anyio.wait_all_tasks_blocked()
                    await strategy.enqueue(events[1])
                    if fail_worker:
                        release.set()
                        await anyio.wait_all_tasks_blocked()
    assert len(flush_errors) == 1
    if fail_worker:
        assert all(
            isinstance(error, MeteringDeliveryError)
            and error.failures[0].cause is failure
            for error in flush_errors
        )
    else:
        assert flush_errors[0].failures[0].reason == "shutdown_timeout"
    on_rejected.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("event_count", [0, 1, 5])
async def test_exit_drains_batches(
    ingest: AsyncMock, events: list[EventInput], event_count: int
) -> None:
    with anyio.fail_after(1):
        async with MemoryEventQueue(batch_size=2, batch_interval=60).open(
            ingest=ingest
        ) as strategy:
            for event in events[:event_count]:
                await strategy.enqueue(event)
    batches = [call.args[0] for call in ingest.await_args_list]
    assert [event for batch in batches for event in batch] == events[:event_count]
    assert all(0 < len(batch) <= 2 for batch in batches)


@pytest.mark.anyio
async def test_exit_shields_in_flight_batch_from_cancellation(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    started = anyio.Event()
    sent: list[EventInput] = []

    async def send(events: list[EventInput]) -> None:
        started.set()
        await anyio.sleep(0.01)
        sent.extend(events)

    ingest.side_effect = send
    with anyio.fail_after(1):
        with anyio.CancelScope() as scope:
            async with MemoryEventQueue(batch_size=1).open(ingest=ingest) as strategy:
                await strategy.enqueue(events[0])
                await started.wait()
                scope.cancel()
                await anyio.lowlevel.checkpoint()
    assert scope.cancelled_caught
    assert sent == events[:1]


@pytest.mark.anyio
async def test_exit_bounds_retry_wait(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    ingest.side_effect = IngestRetryableError("unavailable")
    with anyio.fail_after(1), pytest.raises(MeteringDeliveryError):
        async with MemoryEventQueue(batch_size=1, shutdown_timeout=0.02).open(
            ingest=ingest
        ) as strategy:
            await strategy.enqueue(events[0])
    ingest.assert_awaited_once()


@pytest.mark.anyio
async def test_exit_flushes_before_propagating_body_error(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    with anyio.fail_after(1):
        with pytest.raises(ValueError, match="body failed"):
            async with MemoryEventQueue(batch_interval=60).open(
                ingest=ingest
            ) as strategy:
                await strategy.enqueue(events[0])
                raise ValueError("body failed")
    ingest.assert_awaited_once_with(events[:1])


@pytest.mark.anyio
@pytest.mark.parametrize("drop_first", [False, True])
async def test_shutdown_reports_only_unfinished_events(
    ingest: AsyncMock, events: list[EventInput], drop_first: bool
) -> None:
    async def send(events: list[EventInput]) -> None:
        if events[0]["name"] == "0":
            if drop_first:
                raise IngestRetryableError("unavailable")
            return
        await anyio.sleep_forever()

    ingest.side_effect = send
    with anyio.fail_after(1), pytest.raises(MeteringDeliveryError) as failure:
        async with MemoryEventQueue(
            batch_size=1, shutdown_timeout=0.02, max_attempts=1
        ).open(ingest=ingest) as strategy:
            for event in events[:3]:
                await strategy.enqueue(event)
    expected = [(event, "shutdown_timeout") for event in events[1:3]]
    if drop_first:
        expected.insert(0, (events[0], "retry_exhausted"))
    assert [
        (item.events[0], item.reason) for item in failure.value.failures
    ] == expected


@pytest.mark.anyio
async def test_only_notifies_rejection_for_named_events(
    events: list[EventInput],
) -> None:
    refusal = IngestRejectedError(rejected_indexes={1})
    ingest = AsyncMock(side_effect=[refusal, None])
    on_ack, on_rejected = AsyncMock(), AsyncMock()
    async with MemoryEventQueue().open(
        ingest=ingest, on_ack=on_ack, on_rejected=on_rejected
    ) as queue:
        for event in events[:3]:
            await queue.enqueue(event)
        with pytest.raises(MeteringDeliveryError) as failure:
            await queue.flush()
        assert failure.value.events == [events[1]]
    accepted = [events[0], events[2]]
    assert [call.args[0] for call in ingest.await_args_list] == [events[:3], accepted]
    on_rejected.assert_awaited_once_with([events[1]], "permanent_error")
    on_ack.assert_awaited_once_with(accepted)


@pytest.mark.parametrize("batch_size", [0, -1])
def test_rejects_non_positive_batch_size(batch_size: int) -> None:
    with pytest.raises(ValueError, match="batch_size must be greater than zero"):
        MemoryEventQueue(batch_size=batch_size)


@pytest.mark.anyio
@pytest.mark.parametrize("rejected", [False, True])
async def test_failing_delivery_hook_does_not_stop_the_queue(
    ingest: AsyncMock,
    events: list[EventInput],
    rejected: bool,
    caplog: pytest.LogCaptureFixture,
) -> None:
    hook_error = RuntimeError("private event details")
    rejection = IngestRejectedError("invalid")
    if rejected:
        ingest.side_effect = [rejection, None]
    on_ack = AsyncMock(side_effect=None if rejected else [hook_error, None])
    on_rejected = AsyncMock(side_effect=hook_error)
    async with MemoryEventQueue().open(
        ingest=ingest, on_ack=on_ack, on_rejected=on_rejected
    ) as queue:
        await queue.enqueue(events[0])
        if rejected:
            with pytest.raises(MeteringDeliveryError) as exc_info:
                await queue.flush()
            assert exc_info.value.failures[0].cause is rejection
            on_rejected.assert_awaited_once_with(events[:1], "permanent_error")
        else:
            await queue.flush()
            on_rejected.assert_not_awaited()
        await queue.enqueue(events[1])
        await queue.flush()
    assert ingest.await_count == 2
    hook = "rejection" if rejected else "acknowledgement"
    assert f"Memory queue {hook} hook failed (RuntimeError)" in caplog.messages
    assert "private event details" not in caplog.text


@pytest.mark.anyio
async def test_background_failures_go_to_the_newest_overlapping_flush(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    reporting = anyio.Event()
    release = anyio.Event()
    observed: list[MeteringDeliveryError] = []
    cause = IngestRejectedError("invalid")

    async def on_rejected(batch: list[EventInput], reason: DropReason) -> None:
        reporting.set()
        await release.wait()

    async def flush() -> None:
        try:
            await strategy.flush()
        except MeteringDeliveryError as error:
            observed.append(error)

    ingest.side_effect = cause
    with anyio.fail_after(1):
        async with MemoryEventQueue(batch_size=1).open(
            ingest=ingest, on_rejected=on_rejected
        ) as strategy:
            await strategy.enqueue(events[0])
            await reporting.wait()
            async with anyio.create_task_group() as callers:
                callers.start_soon(flush)
                callers.start_soon(flush)
                await anyio.wait_all_tasks_blocked()
                release.set()
            assert len(observed) == 1
            assert observed[0].events == events[:1]
            assert observed[0].failures[0].reason == "permanent_error"
            assert observed[0].failures[0].cause is cause
            ingest.side_effect = None
            await strategy.enqueue(events[1])
            await strategy.flush()


@pytest.mark.anyio
async def test_a_newer_flush_releases_older_ones_and_reports_their_failures(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    release = anyio.Event()
    released = anyio.Event()
    observed: list[MeteringDeliveryError] = []
    cause = IngestRejectedError("invalid")

    async def send(events: list[EventInput]) -> None:
        await release.wait()
        raise cause

    async def older() -> None:
        await strategy.flush()
        released.set()

    async def newer() -> None:
        with pytest.raises(MeteringDeliveryError) as failure:
            await strategy.flush()
        observed.append(failure.value)

    ingest.side_effect = send
    with anyio.fail_after(1):
        async with MemoryEventQueue(batch_size=1).open(ingest=ingest) as strategy:
            async with anyio.create_task_group() as callers:
                await strategy.enqueue(events[0])
                callers.start_soon(older)
                await anyio.wait_all_tasks_blocked()
                await strategy.enqueue(events[1])
                callers.start_soon(newer)
                await released.wait()
                assert ingest.await_count == 1
                release.set()
            assert observed[0].events == events[:2]
            assert observed[0].failures[0].cause is cause


@pytest.mark.anyio
async def test_a_newer_flush_with_a_shorter_timeout_does_not_release_older_ones(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    release = anyio.Event()
    released = anyio.Event()

    async def send(events: list[EventInput]) -> None:
        await release.wait()

    async def older() -> None:
        await strategy.flush()
        released.set()

    ingest.side_effect = send
    with anyio.fail_after(1):
        async with MemoryEventQueue(batch_size=1).open(ingest=ingest) as strategy:
            async with anyio.create_task_group() as callers:
                await strategy.enqueue(events[0])
                callers.start_soon(older)
                await anyio.wait_all_tasks_blocked()
                with pytest.raises(MeteringTimeoutError):
                    await strategy.flush(timeout=0.01)
                assert not released.is_set()
                release.set()
            assert released.is_set()


@pytest.mark.anyio
@pytest.mark.parametrize("cancel", [False, True])
async def test_abandoned_flush_preserves_failures_and_other_waiters(
    ingest: AsyncMock, events: list[EventInput], cancel: bool
) -> None:
    sending = anyio.Event()
    release = anyio.Event()
    completed = anyio.Event()
    cause = IngestRejectedError("invalid")

    async def send(events: list[EventInput]) -> None:
        sending.set()
        await release.wait()
        raise cause

    async def observer() -> None:
        with pytest.raises(MeteringDeliveryError) as failure:
            await strategy.flush()
        assert failure.value.failures[0].cause is cause
        completed.set()

    ingest.side_effect = send
    with anyio.fail_after(1):
        async with MemoryEventQueue(batch_size=1).open(ingest=ingest) as strategy:
            await strategy.enqueue(events[0])
            await sending.wait()
            if cancel:
                with anyio.move_on_after(0.01) as scope:
                    await strategy.flush()
                assert scope.cancelled_caught
            else:
                with pytest.raises(MeteringTimeoutError):
                    await strategy.flush(timeout=0.01)
            async with anyio.create_task_group() as callers:
                callers.start_soon(observer)
                await anyio.wait_all_tasks_blocked()
                assert not completed.is_set()
                release.set()
                await completed.wait()
            await strategy.flush()


@pytest.mark.anyio
async def test_shutdown_timeout_does_not_invoke_rejection_hook(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    on_rejected = AsyncMock()

    async def send(events: list[EventInput]) -> None:
        await anyio.sleep_forever()

    ingest.side_effect = send

    with anyio.fail_after(1), pytest.raises(MeteringDeliveryError) as failure:
        async with MemoryEventQueue(shutdown_timeout=0.01).open(
            ingest=ingest, on_rejected=on_rejected
        ) as strategy:
            await strategy.enqueue(events[0])
    assert failure.value.events == events[:1]
    assert failure.value.failures[0].reason == "shutdown_timeout"
    on_rejected.assert_not_awaited()


@pytest.mark.parametrize("timeout", [-1.0, float("nan"), float("inf")])
@pytest.mark.anyio
async def test_invalid_delivery_timeouts(ingest: AsyncMock, timeout: float) -> None:
    with pytest.raises(ValueError):
        MemoryEventQueue(shutdown_timeout=timeout)
    async with MemoryEventQueue().open(ingest=ingest) as strategy:
        with pytest.raises(ValueError):
            await strategy.flush(timeout=timeout)


@pytest.mark.anyio
async def test_timed_out_drop_reporting_remains_observable(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    reporting = anyio.Event()
    release = anyio.Event()

    async def on_rejected(batch: list[EventInput], reason: DropReason) -> None:
        reporting.set()
        await release.wait()

    ingest.side_effect = IngestRejectedError("invalid")
    with anyio.fail_after(1):
        async with MemoryEventQueue(batch_size=1).open(
            ingest=ingest, on_rejected=on_rejected
        ) as strategy:
            await strategy.enqueue(events[0])
            await reporting.wait()
            with pytest.raises(MeteringTimeoutError):
                await strategy.flush(timeout=0.01)
            release.set()
            with pytest.raises(MeteringDeliveryError) as failure:
                await strategy.flush()
            assert failure.value.events == events[:1]
            await strategy.flush()


@pytest.mark.anyio
async def test_flush_excludes_later_delivery_failures(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    sending = anyio.Event()
    release = anyio.Event()
    completed = anyio.Event()

    async def send(events: list[EventInput]) -> None:
        if events[0]["name"] == "0":
            sending.set()
            await release.wait()
        else:
            raise IngestRejectedError("invalid")

    async def first_flush() -> None:
        await strategy.flush()
        completed.set()

    ingest.side_effect = send
    with anyio.fail_after(1):
        async with MemoryEventQueue(batch_size=1).open(ingest=ingest) as strategy:
            await strategy.enqueue(events[0])
            await sending.wait()
            async with anyio.create_task_group() as callers:
                callers.start_soon(first_flush)
                await anyio.wait_all_tasks_blocked()
                await strategy.enqueue(events[1])
                release.set()
                with pytest.raises(MeteringDeliveryError) as failure:
                    await strategy.flush()
                assert failure.value.events == events[1:2]
                await completed.wait()


@pytest.mark.anyio
async def test_cancellation_at_completion_does_not_acknowledge_failure(
    ingest: AsyncMock, events: list[EventInput], monkeypatch: pytest.MonkeyPatch
) -> None:
    sending = anyio.Event()
    release = anyio.Event()
    abandoned = anyio.Event()

    async def send(events: list[EventInput]) -> None:
        sending.set()
        await release.wait()
        raise IngestRejectedError("invalid")

    async def flush(*, task_status: anyio.abc.TaskStatus[anyio.CancelScope]) -> None:
        with anyio.CancelScope() as scope:
            task_status.started(scope)
            await strategy.flush()
        assert scope.cancelled_caught
        abandoned.set()

    ingest.side_effect = send
    with anyio.fail_after(1):
        async with MemoryEventQueue(batch_size=1).open(ingest=ingest) as strategy:
            await strategy.enqueue(events[0])
            await sending.wait()
            async with anyio.create_task_group() as callers:
                scope = await callers.start(flush)
                original_finish = strategy._finish

                def finish(request: _FlushRequest) -> None:
                    original_finish(request)
                    scope.cancel()

                monkeypatch.setattr(strategy, "_finish", finish)
                release.set()
                await abandoned.wait()
            with pytest.raises(MeteringDeliveryError) as failure:
                await strategy.flush()
            assert failure.value.events == events[:1]


@pytest.mark.anyio
async def test_ambiguous_timeout_does_not_invoke_rejection_hook(
    ingest: AsyncMock, events: list[EventInput]
) -> None:
    ingest.side_effect = IngestRetryableError("timed out")
    queue = MemoryEventQueue(max_attempts=1)
    on_rejected = AsyncMock()
    async with queue.open(ingest=ingest, on_rejected=on_rejected):
        await queue.enqueue(events[0])
        with pytest.raises(MeteringDeliveryError) as failure:
            await queue.flush()
        assert failure.value.failures[0].reason == "retry_exhausted"
        on_rejected.assert_not_awaited()
