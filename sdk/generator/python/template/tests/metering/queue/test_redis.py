import collections
import collections.abc
import contextlib
import functools
import itertools
import json
import time
import typing
from unittest.mock import AsyncMock

import anyio
import httpx2
import pytest
from fakeredis import FakeAsyncRedis, FakeServer
from redis.asyncio import Redis

from polar.metering.events import ingest_events
from polar.metering.errors import DropReason, MeteringTimeoutError
from polar.metering.events import EventInput
from polar.metering.queue import EventQueue
from polar.metering.queue.redis import RedisEventQueue
from tests.redis import _cost


@pytest.fixture
def server(monkeypatch: pytest.MonkeyPatch) -> FakeServer:
    server = FakeServer()

    @contextlib.asynccontextmanager
    async def connect(url: str):
        async with FakeAsyncRedis(server=server) as redis:
            yield redis

    monkeypatch.setattr("polar.metering.queue.redis.connect_redis", connect)
    return server


@pytest.mark.anyio
async def test_redis_queue_retries_with_the_same_event_and_reports_acceptance(
    server: FakeServer,
) -> None:
    attempts: list[EventInput] = []
    accepted: list[EventInput] = []
    rejected: list[EventInput] = []

    def ingest(request: httpx2.Request) -> httpx2.Response:
        assert request.url.path == "/v1/events/ingest"
        attempts.extend(json.loads(request.content)["events"])
        return httpx2.Response(408 if len(attempts) == 1 else 202)

    async def on_ack(events: list[EventInput]) -> None:
        accepted.extend(events)

    async def on_rejected(events: list[EventInput], reason: DropReason) -> None:
        rejected.extend(events)

    async with (
        FakeAsyncRedis(server=server) as redis,
        httpx2.AsyncClient(
            base_url="https://polar.test", transport=httpx2.MockTransport(ingest)
        ) as client,
    ):
        queue: EventQueue = RedisEventQueue(
            redis="redis://localhost",
            stream="test:queue",
        )
        send = functools.partial(ingest_events, client)
        first_ack = AsyncMock()
        async with queue.open(ingest=send, on_ack=first_ack, on_rejected=on_rejected):
            await queue.enqueue({"name": "call", "external_customer_id": "alice"})
            # Redis keeps what a drain fails to deliver: the next flush takes it.
            await queue.flush(timeout=0.1)
            assert len(attempts) == 1
            assert not accepted
            assert not rejected
            assert await redis.xlen("test:queue") == 1

        await redis.hset("test:queue:backoff", "retry_at", 0)
        async with queue.open(ingest=send, on_ack=on_ack, on_rejected=on_rejected):
            await queue.flush()

        assert len(attempts) == 2
        first_ack.assert_not_awaited()
        assert attempts[0] == attempts[1]
        assert attempts[0]["external_id"]
        assert attempts[0]["timestamp"]
        assert accepted == [attempts[0]]
        assert not rejected
        assert await redis.xlen("test:queue") == 0


@pytest.mark.anyio
async def test_redis_queue_reports_a_rejection_before_retiring_the_entry(
    server: FakeServer,
    caplog: pytest.LogCaptureFixture,
) -> None:
    rejected: list[tuple[list[EventInput], DropReason]] = []
    event: EventInput = {
        "name": "call",
        "external_customer_id": "alice",
        "external_id": "event-1",
        "timestamp": "2026-11-25T12:00:00Z",
    }

    async with (
        FakeAsyncRedis(server=server) as redis,
        httpx2.AsyncClient(
            base_url="https://polar.test",
            transport=httpx2.MockTransport(lambda request: httpx2.Response(422)),
        ) as client,
    ):

        async def on_rejected(events: list[EventInput], reason: DropReason) -> None:
            assert await redis.xlen("test:queue") == 1
            rejected.append((events, reason))
            if len(rejected) == 1:
                raise RuntimeError("Reducer unavailable")

        async with RedisEventQueue("redis://localhost", stream="test:queue").open(
            ingest=functools.partial(ingest_events, client), on_rejected=on_rejected
        ) as queue:
            await queue.enqueue(event)
            await queue.flush()

        assert rejected == [([event], "permanent_error")] * 2
        assert await redis.xlen("test:queue") == 0
        assert "Redis queue drain failed" in caplog.messages
        assert "Reducer unavailable" in caplog.text


QUEUE = "test:queue"
BACKOFF = f"{QUEUE}:backoff"
TIMESTAMP = "2026-10-12T12:00:00Z"


@pytest.fixture
def ingest() -> dict[str, typing.Any]:
    return {"requests": [], "statuses": [], "delay": 0}


@pytest.fixture
async def polar_client(
    ingest: dict[str, typing.Any],
) -> collections.abc.AsyncIterator[httpx2.AsyncClient]:
    async def respond(request: httpx2.Request) -> httpx2.Response:
        assert request.url.path == "/v1/events/ingest"
        events = json.loads(request.content)["events"]
        ingest["requests"].append(events)
        status = ingest["statuses"].pop(0) if ingest["statuses"] else 200
        await anyio.sleep(ingest["delay"])
        return httpx2.Response(
            status,
            headers={"Retry-After": "30"} if status == 429 else {},
            json={"inserted": len(events), "duplicates": 0},
        )

    async with httpx2.AsyncClient(
        base_url="https://polar.test", transport=httpx2.MockTransport(respond)
    ) as client:
        yield client


def _usage(external_id: str, tokens: int, timestamp: str = TIMESTAMP) -> EventInput:
    return {
        "name": "call",
        "external_customer_id": "alice",
        "external_id": external_id,
        "timestamp": timestamp,
        "metadata": {"tokens": tokens},
    }


async def _queued(redis: Redis) -> list[typing.Any]:
    entries = await redis.xrange(QUEUE) or []
    return [json.loads(fields[b"event"]) for _, fields in entries if fields]


def _delivered(ingest: dict[str, typing.Any]) -> list[list[str]]:
    """The external_ids Polar received, request by request."""
    return [[event["external_id"] for event in events] for events in ingest["requests"]]


@pytest.mark.anyio
async def test_skips_periodic_drains_until_the_queue_has_work(
    redis_connection: tuple[str, Redis],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, _ = redis_connection
    monkeypatch.setattr("polar.metering.queue.redis.DRAIN_INTERVAL", 0.01)
    queue = RedisEventQueue(url, stream=QUEUE)
    ingest = AsyncMock()
    drain = AsyncMock(wraps=queue._drain_queue)
    monkeypatch.setattr(queue, "_drain_queue", drain)
    async with queue.open(ingest=ingest):
        await anyio.sleep(0.03)
        drain.assert_not_awaited()
        event = _usage("event-0", 10)
        await queue.enqueue(event)
        with anyio.fail_after(1):
            while not ingest.await_count:
                await anyio.sleep(0.01)
        ingest.assert_awaited_once_with([event])


@pytest.mark.anyio
async def test_delivers_what_it_queued_on_its_own_without_a_flush(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, _ = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        await queue.enqueue(_usage("event-0", 10))
        with anyio.fail_after(3):
            while not ingest["requests"]:
                await anyio.sleep(0.05)
        assert _delivered(ingest) == [["event-0"]]


@pytest.mark.anyio
async def test_delivers_the_stream_in_batches_of_a_thousand_whichever_instance_flushes(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    async with (
        RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as first,
        RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as second,
    ):
        outposts = (first, second)
        for index in range(2500):
            await outposts[index % 2].enqueue(_usage(f"event-{index}", 1))
        async with anyio.create_task_group() as group:
            for queue in outposts:
                group.start_soon(queue.flush)
    # The periodic drain may send part of the stream while it is written.
    assert max(len(events) for events in ingest["requests"]) == 1000
    assert (
        len({external_id for ids in _delivered(ingest) for external_id in ids}) == 2500
    )
    assert await redis.xlen(QUEUE) == 0


@pytest.mark.anyio
async def test_keeps_a_batch_polar_fails_to_take_and_the_fleet_waits_to_send_it_again(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    async with (
        RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue,
        RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as other,
    ):
        await queue.enqueue(_usage("event-0", 10))
        ingest["statuses"] = [503]
        # Redis stores whole milliseconds.
        failed = int(time.time() * 1000)
        await queue._drain()
        assert await _queued(redis) == [_usage("event-0", 10)]
        assert float(await redis.hget(BACKOFF, "retry_at") or 0) >= failed + 1000
        await other.enqueue(_usage("event-1", 10))
        await other._drain()
        assert len(ingest["requests"]) == 1
        await redis.hset(BACKOFF, "retry_at", 0)
        await queue._drain()
        assert _delivered(ingest) == [["event-0"], ["event-0"], ["event-1"]]
        assert await redis.xlen(QUEUE) == 0
        assert not await redis.exists(BACKOFF)


@pytest.mark.anyio
async def test_sends_a_batch_that_failed_on_another_slot_again_once_the_backoff_ends(
    monkeypatch: pytest.MonkeyPatch,
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    monkeypatch.setattr("polar.metering.queue.redis.DRAIN_INTERVAL", 60)
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        # Two full batches: two flushers, and Polar fails both.
        for index in range(2000):
            await queue.enqueue(_usage(f"event-{index}", 1))
        ingest["statuses"] = [503, 503]
        await queue._drain()
        assert len(ingest["requests"]) == 2
        await redis.hset(BACKOFF, "retry_at", 0)
        # Nothing new waits, so the next drain starts one flusher: it sends both
        # batches.
        await queue._drain()
        assert len({id for batch in _delivered(ingest) for id in batch}) == 2000
        assert await redis.xlen(QUEUE) == 0


@pytest.mark.anyio
async def test_waits_as_long_as_a_polar_that_rate_limits_it_asks(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        await queue.enqueue(_usage("event-0", 10))
        ingest["statuses"] = [429]
        # Redis stores whole milliseconds.
        failed = int(time.time() * 1000)
        await queue._drain()
        retry_at = float(await redis.hget(BACKOFF, "retry_at") or 0)
        assert failed + 30_000 <= retry_at <= time.time() * 1000 + 30_000


@pytest.mark.anyio
async def test_keeps_a_backoff_another_flusher_set_while_this_one_delivered(
    redis_connection: tuple[str, Redis], polar_client: httpx2.AsyncClient
) -> None:
    url, redis = redis_connection
    later = int(time.time() * 1000) + 60_000

    async def on_delivered(events: list[EventInput]) -> None:
        await redis.hset(BACKOFF, "retry_at", later)

    await redis.hset(BACKOFF, mapping={"failures": 1, "retry_at": 1})
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client), on_ack=on_delivered) as queue:
        await queue.enqueue(_usage("event-0", 10))
        await queue.flush()
        assert await redis.hget(BACKOFF, "retry_at") == str(later).encode()


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("event", '{"external_id":"unreadable","ratio":NaN}'),
        ("event", '{"external_id":"unreadable","ratio":1e999}'),
        ("other", "unreadable"),
    ],
)
async def test_skips_a_queue_entry_it_cannot_read_and_delivers_the_rest(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
    field: str,
    value: str,
) -> None:
    url, redis = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        await redis.xadd(QUEUE, {field: value})
        await queue.enqueue(_usage("event-0", 10))
        await queue.flush()
        assert _delivered(ingest) == [["event-0"]]
        assert await redis.xlen(QUEUE) == 0


@pytest.mark.anyio
async def test_delivers_an_event_another_sdk_queued_in_a_form_it_cannot_parse(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        # Another SDK takes a timestamp this one refuses.
        foreign = _usage("foreign", 10, timestamp="2026-10-12t12:00:00z")
        await redis.xadd(QUEUE, {"event": json.dumps(foreign)})
        await queue.enqueue(_usage("event-0", 10))
        await queue.flush()
        assert _delivered(ingest) == [["foreign", "event-0"]]
        assert await redis.xlen(QUEUE) == 0


@pytest.mark.anyio
async def test_refuses_to_enqueue_a_number_json_cannot_carry(
    redis_connection: tuple[str, Redis], polar_client: httpx2.AsyncClient
) -> None:
    url, redis = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        event = _usage("event-0", 10)
        event["metadata"] = {"tokens": 10, "ratio": float("nan")}
        with pytest.raises(ValueError, match="JSON"):
            await queue.enqueue(event)
        assert await redis.xlen(QUEUE) == 0


@pytest.mark.anyio
async def test_takes_back_the_batch_of_a_flusher_that_died_on_the_next_drain(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        await queue.enqueue(_usage("event-0", 10))
        # A flusher read the batch and froze before Polar answered.
        [[_, entries]] = typing.cast(
            list[typing.Any],
            await redis.xreadgroup("polar", "frozen", {QUEUE: ">"}, count=1000),
        )
        await queue._drain()
        assert ingest["requests"] == []
        await redis.xclaim(
            QUEUE, "polar", "frozen", 0, [entry for entry, _ in entries], idle=60_000
        )
        await queue.enqueue(_usage("event-1", 10))
        await queue._drain()
        assert sorted(
            external_id for ids in _delivered(ingest) for external_id in ids
        ) == ["event-0", "event-1"]
        assert await redis.xlen(QUEUE) == 0


@pytest.mark.anyio
async def test_sends_only_full_batches_while_another_flusher_delivers(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        await queue.enqueue(_usage("event-0", 10))
        # Another flusher holds a batch in flight.
        await redis.xreadgroup("polar", "other", {QUEUE: ">"})
        for index in range(1, 1002):
            await queue.enqueue(_usage(f"event-{index}", 1))
        await queue._drain()
        assert [len(ids) for ids in _delivered(ingest)] == [1000]
        # The other flusher delivered its batch, and the rest goes.
        [[entry, _]] = typing.cast(
            list[typing.Any], await redis.xrange(QUEUE, count=1)
        )
        await redis.xack(QUEUE, "polar", entry)
        await redis.xdel(QUEUE, entry)
        await queue._drain()
        assert [len(ids) for ids in _delivered(ingest)] == [1000, 1]
        assert _delivered(ingest)[1] == ["event-1001"]


@pytest.mark.anyio
async def test_returns_from_a_flush_once_its_drain_ends_while_another_flusher_still_delivers(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        await queue.enqueue(_usage("event-0", 10))
        # Another flusher holds a batch in flight.
        await redis.xreadgroup("polar", "other", {QUEUE: ">"})
        await queue.enqueue(_usage("event-1", 10))
        # A serverless instance flushes after each response: it must not wait on the
        # fleet's stream.
        await queue.flush(timeout=0.5)
        assert _delivered(ingest) == []


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("newer_timeout", "returned"),
    [
        (30.0, ["older", "newer"]),
        # A newer flush that gives up first does not release the one still waiting.
        (0.2, ["newer timed out", "older"]),
    ],
)
async def test_releases_an_older_flush_when_a_newer_one_outlasts_it(
    redis_connection: tuple[str, Redis],
    newer_timeout: float,
    returned: list[str],
) -> None:
    url, _ = redis_connection
    delivering = anyio.Event()
    deliver = anyio.Event()

    async def ingest(events: list[EventInput]) -> None:
        delivering.set()
        await deliver.wait()

    done: list[str] = []

    async def flush(name: str, timeout: float) -> None:
        try:
            await queue.flush(timeout=timeout)
            done.append(name)
        except MeteringTimeoutError:
            done.append(f"{name} timed out")

    async with RedisEventQueue(url, stream=QUEUE).open(ingest=ingest) as queue:
        await queue.enqueue(_usage("event-0", 10))
        async with anyio.create_task_group() as group:
            group.start_soon(flush, "older", 30.0)
            await delivering.wait()
            # A serverless instance serves many ticks at once: one keeps it alive until
            # the drain ends, the others answer.
            group.start_soon(flush, "newer", newer_timeout)
            with anyio.fail_after(1):
                while not done:
                    await anyio.sleep(0.01)
            assert done == returned[:1]
            deliver.set()
        assert done == returned


@pytest.mark.anyio
async def test_delivers_what_another_instance_queued_while_it_flushed(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
) -> None:
    url, redis = redis_connection
    async with (
        RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as first,
        RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as second,
    ):
        await first.enqueue(_usage("event-0", 10))
        ingest["delay"] = 0.1
        async with anyio.create_task_group() as group:
            group.start_soon(first.flush)
            with anyio.fail_after(1):
                while not ingest["requests"]:
                    await anyio.sleep(0.01)
            await second.enqueue(_usage("event-1", 10))
            await second.flush()
    assert sorted(external_id for ids in _delivered(ingest) for external_id in ids) == [
        "event-0",
        "event-1",
    ]
    assert await redis.xlen(QUEUE) == 0


@pytest.mark.anyio
async def test_drains_after_an_empty_flush(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, _ = redis_connection
    monkeypatch.setattr("polar.metering.queue.redis.FLUSH_TENURE", 0.1)
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        await queue.flush()
        await anyio.sleep(0.2)
        await queue.enqueue(_usage("event-0", 10))
        await queue.flush()
        assert _delivered(ingest) == [["event-0"]]


@pytest.mark.anyio
async def test_hands_its_slot_over_a_few_seconds_into_a_drain_a_flush_waits_on(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    ingest: dict[str, typing.Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    url, _ = redis_connection
    monkeypatch.setattr("polar.metering.queue.redis.FLUSH_TENURE", 0.3)
    async with (
        RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as first,
        RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as second,
    ):
        await first.enqueue(_usage("event-0", 10))
        ingest["delay"] = 0.04

        async def write() -> None:
            # Another instance queues events during each of the flusher's ingest round
            # trips.
            for index in itertools.count():
                await second.enqueue(_usage(f"other-{index}", 1))
                await anyio.sleep(0.01)

        async with anyio.create_task_group() as group:
            group.start_soon(write)
            with anyio.fail_after(2):
                await first.flush()
            group.cancel_scope.cancel()
    assert "event-0" in [external_id for ids in _delivered(ingest) for external_id in ids]


@pytest.mark.anyio
async def test_flushes_a_thousand_events_in_as_many_commands_as_one(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    redis_commands: collections.Counter[str],
) -> None:
    url, redis = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:

        async def flush_cost(events: int) -> dict[str, int]:
            for index in range(events):
                await queue.enqueue(_usage(f"event-{index}", 1))
            cost = await _cost(redis_commands, queue.flush)
            assert await redis.xlen(QUEUE) == 0
            return cost

        await flush_cost(1)
        assert await flush_cost(1000) == await flush_cost(1)


@pytest.mark.anyio
async def test_queues_an_event_in_two_commands_and_flushes_at_no_cost_while_a_flusher_holds_the_first_slot(
    redis_connection: tuple[str, Redis],
    polar_client: httpx2.AsyncClient,
    redis_commands: collections.Counter[str],
) -> None:
    url, redis = redis_connection
    async with RedisEventQueue(url, stream=QUEUE).open(ingest=functools.partial(ingest_events, polar_client)) as queue:
        # A serverless instance flushes on every request: the flusher in flight delivers
        # its event.
        await redis.set(f"{QUEUE}:flusher:0", "other", px=30_000)

        async def enqueue_and_flush() -> None:
            await queue.enqueue(_usage("event", 1))
            await queue.flush()

        assert await _cost(redis_commands, enqueue_and_flush) == {"xadd": 1, "exists": 1}
