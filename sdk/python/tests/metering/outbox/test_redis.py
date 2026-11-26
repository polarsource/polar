import json
from unittest.mock import AsyncMock

import httpx2
import pytest
from fakeredis import FakeAsyncRedis, FakeServer

from polar.metering.errors import DropReason, MeteringTimeoutError
from polar.metering.events import EventInput
from polar.metering.outbox import Outbox
from polar.metering.outbox.redis import RedisOutbox


@pytest.mark.anyio
async def test_redis_outbox_retries_with_the_same_event_and_reports_acceptance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server = FakeServer()
    monkeypatch.setattr(
        "polar._redis.Redis.from_url",
        lambda url, **kwargs: FakeAsyncRedis(server=server, **kwargs),
    )
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
        outbox: Outbox = RedisOutbox(
            "redis://localhost",
            stream="test:outbox",
            client=client,
        )
        first_ack = AsyncMock()
        async with outbox.open(on_ack=first_ack, on_rejected=on_rejected):
            await outbox.enqueue({"name": "call", "external_customer_id": "alice"})
            with pytest.raises(MeteringTimeoutError):
                await outbox.flush(timeout=0.1)
            assert len(attempts) == 1
            assert not accepted
            assert not rejected
            assert await redis.xlen("test:outbox") == 1

        await redis.hset("test:outbox:backoff", "retry_at", 0)
        async with outbox.open(on_ack=on_ack, on_rejected=on_rejected):
            await outbox.flush()

        assert len(attempts) == 2
        first_ack.assert_not_awaited()
        assert attempts[0] == attempts[1]
        assert attempts[0]["external_id"]
        assert attempts[0]["timestamp"]
        assert accepted == [attempts[0]]
        assert not rejected
        assert await redis.xlen("test:outbox") == 0


@pytest.mark.anyio
async def test_redis_outbox_reports_a_rejection_before_retiring_the_entry(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    server = FakeServer()
    monkeypatch.setattr(
        "polar._redis.Redis.from_url",
        lambda url, **kwargs: FakeAsyncRedis(server=server, **kwargs),
    )
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
            assert await redis.xlen("test:outbox") == 1
            rejected.append((events, reason))
            if len(rejected) == 1:
                raise RuntimeError("Reducer unavailable")

        async with RedisOutbox(
            "redis://localhost", stream="test:outbox", client=client
        ).open(on_rejected=on_rejected) as outbox:
            await outbox.enqueue(event)
            await outbox.flush()

        assert rejected == [([event], "permanent_error")] * 2
        assert await redis.xlen("test:outbox") == 0
        assert "Redis outbox drain failed" in caplog.messages
        assert "Reducer unavailable" in caplog.text
