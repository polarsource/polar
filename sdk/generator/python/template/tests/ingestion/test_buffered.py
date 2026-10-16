from unittest.mock import AsyncMock

import anyio
import anyio.lowlevel
import pytest

from polar import PolarNetworkError
from polar.ingestion import IngestionClient
from polar.ingestion.buffered import BufferedIngestionStrategy, DropReason
from polar.ingestion.events import EventInput
from polar.{{ ir.versions[0] | format_version }} import PolarAsync


@pytest.mark.anyio
@pytest.mark.parametrize("event_count", [0, 1, 5])
async def test_exit_drains_batches(
    monkeypatch: pytest.MonkeyPatch, event_count: int
) -> None:
    async with PolarAsync("token") as polar:
        ingest = AsyncMock()
        monkeypatch.setattr(polar.events, "ingest", ingest)
        strategy = BufferedIngestionStrategy(polar, batch_size=2, batch_interval=60)
        events: list[EventInput] = [
            {"name": f"usage-{index}", "external_customer_id": "customer"}
            for index in range(event_count)
        ]
        with anyio.fail_after(1):
            async with strategy:
                for event in events:
                    await strategy.ingest(event)

        batches = [call.kwargs["events"] for call in ingest.await_args_list]
        assert [event for batch in batches for event in batch] == events
        assert all(len(batch) <= 2 for batch in batches)


@pytest.mark.anyio
async def test_exit_shields_in_flight_batch_from_cancellation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started = anyio.Event()
    sent: list[EventInput] = []

    async def send(*, events: list[EventInput]) -> None:
        started.set()
        await anyio.sleep(0.01)
        sent.extend(events)

    event: EventInput = {"name": "usage", "external_customer_id": "customer"}
    async with PolarAsync("token") as polar:
        monkeypatch.setattr(polar.events, "ingest", send)
        strategy = BufferedIngestionStrategy(polar, batch_size=1)
        with anyio.fail_after(1):
            with anyio.CancelScope() as scope:
                async with strategy:
                    await strategy.ingest(event)
                    await started.wait()
                    scope.cancel()
                    await anyio.lowlevel.checkpoint()

        assert scope.cancelled_caught
        assert sent == [event]


@pytest.mark.anyio
async def test_exit_bounds_retry_wait(monkeypatch: pytest.MonkeyPatch) -> None:
    async with PolarAsync("token") as polar:
        ingest = AsyncMock(side_effect=PolarNetworkError("unavailable"))
        monkeypatch.setattr(polar.events, "ingest", ingest)
        strategy = BufferedIngestionStrategy(polar, batch_size=1, shutdown_timeout=0.02)
        started = anyio.current_time()
        with anyio.fail_after(1):
            async with strategy:
                await strategy.ingest(
                    {"name": "usage", "external_customer_id": "customer"}
                )

        assert anyio.current_time() - started < 1
        ingest.assert_awaited_once()


@pytest.mark.anyio
async def test_exit_flushes_before_propagating_body_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with PolarAsync("token") as polar:
        ingest = AsyncMock()
        monkeypatch.setattr(polar.events, "ingest", ingest)
        strategy = BufferedIngestionStrategy(polar, batch_interval=60)
        with anyio.fail_after(1):
            with pytest.raises(ValueError, match="body failed"):
                async with strategy:
                    await strategy.ingest(
                        {"name": "usage", "external_customer_id": "customer"}
                    )
                    raise ValueError("body failed")

        ingest.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize("drop_first", [False, True])
async def test_shutdown_reports_only_unfinished_events(
    monkeypatch: pytest.MonkeyPatch, drop_first: bool
) -> None:
    events: list[EventInput] = [
        {"name": f"usage-{index}", "external_customer_id": "customer"}
        for index in range(3)
    ]
    dropped: list[tuple[list[EventInput], DropReason]] = []

    async def on_dropped(batch: list[EventInput], reason: DropReason) -> None:
        await anyio.lowlevel.checkpoint()
        dropped.append((batch, reason))

    async def send(*, events: list[EventInput]) -> None:
        if events[0]["name"] == "usage-0":
            if drop_first:
                raise PolarNetworkError("unavailable")
            return
        await anyio.sleep_forever()

    async with PolarAsync("token") as polar:
        monkeypatch.setattr(polar.events, "ingest", send)
        strategy = BufferedIngestionStrategy(
            polar,
            batch_size=1,
            shutdown_timeout=0.02,
            max_attempts=1,
            on_dropped=on_dropped,
        )
        with anyio.fail_after(1):
            async with strategy:
                for event in events:
                    await strategy.ingest(event)

    expected = [(events[1:], "shutdown_timeout")]
    if drop_first:
        expected.insert(0, (events[:1], "retry_exhausted"))
    assert dropped == expected


@pytest.mark.anyio
async def test_structural_ingestion_client() -> None:
    received: list[EventInput] = []

    class Events:
        async def ingest(self, *, events: list[EventInput]) -> None:
            received.extend(events)

    class Client:
        events = Events()

    client: IngestionClient = Client()
    event: EventInput = {"name": "usage", "external_customer_id": "customer"}
    async with BufferedIngestionStrategy(client, batch_interval=60) as strategy:
        await strategy.ingest(event)

    assert received == [event]


@pytest.mark.parametrize("batch_size", [0, -1])
def test_rejects_non_positive_batch_size(batch_size: int) -> None:
    with pytest.raises(ValueError, match="batch_size must be greater than zero"):
        BufferedIngestionStrategy(AsyncMock(), batch_size=batch_size)
