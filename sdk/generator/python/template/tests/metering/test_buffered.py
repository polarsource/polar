import time
from unittest.mock import AsyncMock

import anyio
import anyio.lowlevel
import pytest

from polar import PolarClientError, PolarError, PolarNetworkError, PolarRateLimitError
from polar.metering import FlushProtocol
from polar.metering.buffered import BufferedMeteringStrategy, DropReason
from polar.metering.client import MeteringClient
from polar.metering.events import EventInput


@pytest.fixture
def client() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def events() -> list[EventInput]:
    return [
        {"name": str(index), "external_customer_id": "customer"} for index in range(5)
    ]


@pytest.mark.anyio
async def test_flush_drains_batches_and_keeps_accepting_events(
    client: AsyncMock, events: list[EventInput]
) -> None:
    strategy = BufferedMeteringStrategy(client, batch_size=2, batch_interval=60)
    assert isinstance(strategy, FlushProtocol)
    with pytest.raises(PolarError, match="has not started"):
        await strategy.flush()
    with anyio.fail_after(1):
        async with strategy:
            await strategy.flush()
            client.events.ingest.assert_not_awaited()
            for event in events:
                await strategy.track(event)
            await strategy.flush()
            batches = [
                call.kwargs["events"] for call in client.events.ingest.await_args_list
            ]
            assert batches == [events[:2], events[2:4], events[4:]]
            client.events.ingest.reset_mock()
            await strategy.track(events[0])
            await strategy.flush()
            client.events.ingest.assert_awaited_once_with(events=events[:1])
    with pytest.raises(anyio.ClosedResourceError):
        await strategy.flush()


@pytest.mark.anyio
@pytest.mark.parametrize("batch_size, batch_interval", [(1, 60), (100, 0.01), (100, 0)])
async def test_batching_without_explicit_flush(
    client: AsyncMock, events: list[EventInput], batch_size: int, batch_interval: float
) -> None:
    sent = anyio.Event()
    client.events.ingest.side_effect = lambda **kwargs: sent.set()
    with anyio.fail_after(1):
        async with BufferedMeteringStrategy(
            client, batch_size=batch_size, batch_interval=batch_interval
        ) as strategy:
            await strategy.track(events[0])
            await sent.wait()
            client.events.ingest.assert_awaited_once_with(events=events[:1])


@pytest.mark.anyio
@pytest.mark.parametrize("cancel_first", [False, True])
async def test_overlapping_flushes_have_independent_boundaries(
    client: AsyncMock, events: list[EventInput], cancel_first: bool
) -> None:
    release = [anyio.Event() for _ in range(3)]
    completed = [anyio.Event(), anyio.Event()]
    scopes = [anyio.CancelScope(), anyio.CancelScope()]

    async def send(*, events: list[EventInput]) -> None:
        await release[int(events[0]["name"])].wait()

    async def flush(index: int) -> None:
        with scopes[index]:
            await strategy.flush()
            completed[index].set()

    client.events.ingest.side_effect = send
    with anyio.fail_after(1):
        async with (
            BufferedMeteringStrategy(client, batch_size=1) as strategy,
            anyio.create_task_group() as callers,
        ):
            for index in range(2):
                await strategy.track(events[index])
                callers.start_soon(flush, index)
                await anyio.wait_all_tasks_blocked()
            await strategy.track(events[2])
            assert not any(done.is_set() for done in completed)
            if cancel_first:
                scopes[0].cancel()
            release[0].set()
            await anyio.wait_all_tasks_blocked()
            assert completed[0].is_set() is not cancel_first
            assert not completed[1].is_set()
            release[1].set()
            await completed[1].wait()
            await anyio.wait_all_tasks_blocked()
            assert client.events.ingest.await_count == 3
            release[2].set()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "batch_size, batches", [(100, [[1, 2, 3]]), (2, [[1, 2], [3]])]
)
async def test_pending_flushes_batch_queued_events(
    client: AsyncMock,
    events: list[EventInput],
    batch_size: int,
    batches: list[list[int]],
) -> None:
    release: list[anyio.Event] = []
    completed = [anyio.Event() for _ in range(4)]

    async def send(*, events: list[EventInput]) -> None:
        gate = anyio.Event()
        release.append(gate)
        await gate.wait()

    async def flush(index: int) -> None:
        await strategy.flush()
        completed[index].set()

    client.events.ingest.side_effect = send
    with anyio.fail_after(1):
        async with (
            BufferedMeteringStrategy(
                client, batch_size=batch_size, batch_interval=60
            ) as strategy,
            anyio.create_task_group() as callers,
        ):
            for index in range(4):
                await strategy.track(events[index])
                callers.start_soon(flush, index)
                await anyio.wait_all_tasks_blocked()
            assert client.events.ingest.await_count == 1
            release[0].set()
            await completed[0].wait()
            delivered = 1
            for index, batch in enumerate(batches):
                await anyio.wait_all_tasks_blocked()
                assert client.events.ingest.await_count == index + 2
                call = client.events.ingest.await_args_list[index + 1]
                assert call.kwargs["events"] == [events[i] for i in batch]
                assert [done.is_set() for done in completed] == [
                    i < delivered for i in range(4)
                ]
                release[index + 1].set()
                delivered += len(batch)
                for done in completed[:delivered]:
                    await done.wait()
            await anyio.wait_all_tasks_blocked()
            assert client.events.ingest.await_count == len(batches) + 1


@pytest.mark.anyio
async def test_flush_waits_for_retries(
    client: AsyncMock, events: list[EventInput]
) -> None:
    client.events.ingest.side_effect = [PolarRateLimitError(429, 0), None]
    with anyio.fail_after(3):
        async with BufferedMeteringStrategy(client, batch_interval=60) as strategy:
            await strategy.track(events[0])
            await strategy.flush()
            first, second = client.events.ingest.await_args_list
            assert first.kwargs["events"] == events[:1]
            assert first == second


@pytest.mark.anyio
async def test_retry_after_waits_a_second_without_spending_attempts(
    client: AsyncMock, events: list[EventInput]
) -> None:
    on_dropped = AsyncMock()
    calls: list[float] = []

    async def send(*, events: list[EventInput]) -> None:
        calls.append(time.monotonic())
        if len(calls) == 1:
            raise PolarRateLimitError(429, 0)

    client.events.ingest.side_effect = send
    with anyio.fail_after(3):
        async with BufferedMeteringStrategy(
            client, batch_interval=60, max_attempts=1, on_dropped=on_dropped
        ) as strategy:
            await strategy.track(events[0])
            await strategy.flush()
            assert len(calls) == 2
            assert calls[1] - calls[0] >= 0.9
            on_dropped.assert_not_awaited()


@pytest.mark.anyio
async def test_retry_after_beyond_budget_drops_the_batch(
    client: AsyncMock, events: list[EventInput]
) -> None:
    on_dropped = AsyncMock()
    client.events.ingest.side_effect = PolarRateLimitError(429, 301)
    with anyio.fail_after(0.5):
        async with BufferedMeteringStrategy(
            client, batch_interval=60, shutdown_timeout=0.02, on_dropped=on_dropped
        ) as strategy:
            await strategy.track(events[0])
            await strategy.flush()
            client.events.ingest.assert_awaited_once()
            on_dropped.assert_awaited_once_with(events[:1], "retry_exhausted")


@pytest.mark.anyio
@pytest.mark.parametrize(
    "error, reason",
    [
        (PolarNetworkError("offline"), "retry_exhausted"),
        (PolarClientError(422, "invalid"), "permanent_error"),
    ],
)
async def test_flush_waits_for_drop_reporting(
    client: AsyncMock, events: list[EventInput], error: Exception, reason: DropReason
) -> None:
    reporting = anyio.Event()
    release = anyio.Event()
    completed = anyio.Event()

    async def on_dropped(batch: list[EventInput], drop_reason: DropReason) -> None:
        assert batch == events[:1]
        assert drop_reason == reason
        reporting.set()
        await release.wait()

    async def flush() -> None:
        await strategy.flush()
        completed.set()

    client.events.ingest.side_effect = error
    with anyio.fail_after(1):
        async with (
            BufferedMeteringStrategy(
                client, batch_interval=60, max_attempts=1, on_dropped=on_dropped
            ) as strategy,
            anyio.create_task_group() as callers,
        ):
            await strategy.track(events[0])
            callers.start_soon(flush)
            await reporting.wait()
            assert not completed.is_set()
            release.set()
            await completed.wait()
    client.events.ingest.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("fail_worker", [False, True])
async def test_worker_exit_releases_active_and_queued_flushes(
    client: AsyncMock, events: list[EventInput], fail_worker: bool
) -> None:
    release = anyio.Event()
    failure = TypeError("broken transport")
    flush_errors: list[BaseException] = []

    async def send(*, events: list[EventInput]) -> None:
        await release.wait()
        raise failure

    async def flush() -> None:
        with anyio.CancelScope(shield=True):
            with pytest.raises(TypeError if fail_worker else TimeoutError) as exc_info:
                await strategy.flush()
            flush_errors.append(exc_info.value)

    client.events.ingest.side_effect = send
    on_dropped = AsyncMock()
    strategy = BufferedMeteringStrategy(
        client, batch_interval=60, shutdown_timeout=0.02, on_dropped=on_dropped
    )
    with anyio.fail_after(1):
        async with anyio.create_task_group() as callers:
            try:
                async with strategy:
                    await strategy.track(events[0])
                    for _ in range(2):
                        callers.start_soon(flush)
                        await anyio.wait_all_tasks_blocked()
                    await strategy.track(events[1])
                    if fail_worker:
                        release.set()
                        await anyio.sleep_forever()
            except ExceptionGroup as errors:
                assert fail_worker
                assert errors.exceptions == (failure,)
            else:
                assert not fail_worker
    assert len(flush_errors) == 2
    if fail_worker:
        assert all(error is failure for error in flush_errors)
    else:
        on_dropped.assert_awaited_once_with(events[:2], "shutdown_timeout")


@pytest.mark.anyio
@pytest.mark.parametrize("event_count", [0, 1, 5])
async def test_exit_drains_batches(
    client: AsyncMock, events: list[EventInput], event_count: int
) -> None:
    with anyio.fail_after(1):
        async with BufferedMeteringStrategy(
            client, batch_size=2, batch_interval=60
        ) as strategy:
            for event in events[:event_count]:
                await strategy.track(event)
    batches = [call.kwargs["events"] for call in client.events.ingest.await_args_list]
    assert [event for batch in batches for event in batch] == events[:event_count]
    assert all(0 < len(batch) <= 2 for batch in batches)


@pytest.mark.anyio
async def test_exit_shields_in_flight_batch_from_cancellation(
    client: AsyncMock, events: list[EventInput]
) -> None:
    started = anyio.Event()
    sent: list[EventInput] = []

    async def send(*, events: list[EventInput]) -> None:
        started.set()
        await anyio.sleep(0.01)
        sent.extend(events)

    client.events.ingest.side_effect = send
    with anyio.fail_after(1):
        with anyio.CancelScope() as scope:
            async with BufferedMeteringStrategy(client, batch_size=1) as strategy:
                await strategy.track(events[0])
                await started.wait()
                scope.cancel()
                await anyio.lowlevel.checkpoint()
    assert scope.cancelled_caught
    assert sent == events[:1]


@pytest.mark.anyio
async def test_exit_bounds_retry_wait(
    client: AsyncMock, events: list[EventInput]
) -> None:
    client.events.ingest.side_effect = PolarNetworkError("unavailable")
    with anyio.fail_after(1):
        async with BufferedMeteringStrategy(
            client, batch_size=1, shutdown_timeout=0.02
        ) as strategy:
            await strategy.track(events[0])
    client.events.ingest.assert_awaited_once()


@pytest.mark.anyio
async def test_exit_flushes_before_propagating_body_error(
    client: AsyncMock, events: list[EventInput]
) -> None:
    with anyio.fail_after(1):
        with pytest.raises(ValueError, match="body failed"):
            async with BufferedMeteringStrategy(client, batch_interval=60) as strategy:
                await strategy.track(events[0])
                raise ValueError("body failed")
    client.events.ingest.assert_awaited_once_with(events=events[:1])


@pytest.mark.anyio
@pytest.mark.parametrize("drop_first", [False, True])
async def test_shutdown_reports_only_unfinished_events(
    client: AsyncMock, events: list[EventInput], drop_first: bool
) -> None:
    dropped: list[tuple[list[EventInput], DropReason]] = []

    async def on_dropped(batch: list[EventInput], reason: DropReason) -> None:
        await anyio.lowlevel.checkpoint()
        dropped.append((batch, reason))

    async def send(*, events: list[EventInput]) -> None:
        if events[0]["name"] == "0":
            if drop_first:
                raise PolarNetworkError("unavailable")
            return
        await anyio.sleep_forever()

    client.events.ingest.side_effect = send
    with anyio.fail_after(1):
        async with BufferedMeteringStrategy(
            client,
            batch_size=1,
            shutdown_timeout=0.02,
            max_attempts=1,
            on_dropped=on_dropped,
        ) as strategy:
            for event in events[:3]:
                await strategy.track(event)
    expected = [(events[1:3], "shutdown_timeout")]
    if drop_first:
        expected.insert(0, (events[:1], "retry_exhausted"))
    assert dropped == expected


@pytest.mark.anyio
async def test_structural_metering_client(events: list[EventInput]) -> None:
    received: list[EventInput] = []

    class Events:
        async def ingest(self, *, events: list[EventInput]) -> None:
            received.extend(events)

    class Client:
        events = Events()

    client: MeteringClient = Client()
    async with BufferedMeteringStrategy(client, batch_interval=60) as strategy:
        await strategy.track(events[0])
    assert received == events[:1]


@pytest.mark.parametrize("batch_size", [0, -1])
def test_rejects_non_positive_batch_size(client: AsyncMock, batch_size: int) -> None:
    with pytest.raises(ValueError, match="batch_size must be greater than zero"):
        BufferedMeteringStrategy(client, batch_size=batch_size)


@pytest.mark.anyio
async def test_a_failing_on_delivered_stays_out_of_the_delivery_retries(
    client: AsyncMock, events: list[EventInput]
) -> None:
    failure = PolarNetworkError("callback failed")
    on_delivered = AsyncMock(side_effect=failure)
    on_dropped = AsyncMock()
    strategy = BufferedMeteringStrategy(
        client, max_attempts=1, on_delivered=on_delivered, on_dropped=on_dropped
    )
    with anyio.fail_after(1):
        try:
            async with strategy:
                await strategy.track(events[0])
                with pytest.raises(PolarNetworkError):
                    await strategy.flush()
        except ExceptionGroup as errors:
            assert errors.exceptions == (failure,)
        else:
            pytest.fail("the worker should have failed")
    client.events.ingest.assert_awaited_once()
    on_dropped.assert_not_awaited()
