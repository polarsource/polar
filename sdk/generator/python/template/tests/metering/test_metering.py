import datetime
import subprocess
import sys
import typing
from unittest.mock import AsyncMock, MagicMock

import anyio
import httpx2
import pytest

from polar import PolarClientError, PolarError
from polar.base import AsyncClientBase
from polar.metering import (
    CustomerMeter,
    EventInput,
    InvalidActorError,
    Metering,
    MeteringDeliveryError,
    MeteringError,
    MeteringTimeoutError,
    EventQueue,
)
from polar.metering.queue.memory import MemoryEventQueue
from polar.outpost import Outpost
from polar.outpost.errors import NotReadyError, UnavailableRedisError
from polar.{{ ir.versions[0] | format_version }} import PolarAsync


@pytest.mark.anyio
@pytest.mark.parametrize(
    "identity",
    [
        {},
        {"customer_id": "customer", "external_customer_id": "customer"},
        {"member_id": "member"},
        {"external_member_id": "member"},
        {"customer_id": "customer", "external_member_id": "member"},
        {"external_customer_id": "customer", "member_id": "member"},
    ],
)
async def test_invalid_actor(identity: dict[str, typing.Any]) -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    async with Metering(
        queue=queue, client=AsyncMock(spec=AsyncClientBase)
    ) as metering:
        with pytest.raises(InvalidActorError) as exc_info:
            await metering.actor(**identity)
        assert isinstance(exc_info.value, MeteringError)
        assert isinstance(exc_info.value, PolarError)

        with pytest.raises(InvalidActorError):
            await metering.track(name="usage", **identity)
        queue.enqueue.assert_not_awaited()


def test_actor_without_outpost_dependencies() -> None:
    subprocess.run(
        [
            sys.executable,
            "-c",
            """
import asyncio
import sys
from unittest.mock import AsyncMock

sys.modules["polar.outpost"] = None
sys.modules["redis"] = None
sys.modules["opentelemetry"] = None

from polar.base import AsyncClientBase
from polar.metering import Metering
from polar.metering.queue.memory import MemoryEventQueue

async def main():
    async with Metering(
        queue=MemoryEventQueue(AsyncMock()),
        client=AsyncMock(spec=AsyncClientBase),
    ) as metering:
        actor = await metering.actor(external_customer_id="customer")
        await actor.track(name="usage")

asyncio.run(main())
""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )


@pytest.mark.anyio
@pytest.mark.parametrize("external", [False, True])
@pytest.mark.parametrize("missing", [False, True])
async def test_meter_api_fallback(
    monkeypatch: pytest.MonkeyPatch, external: bool, missing: bool
) -> None:
    value = {
        "meter_id": "meter",
        "customer_id": "customer",
        "consumed_units": 3,
        "credited_units": 10,
        "balance": 7,
        "id": "customer-meter",
    }
    send = AsyncMock(
        return_value=httpx2.Response(
            200,
            json={
                "items": [] if missing else [value],
                "pagination": {"total_count": 1, "max_page": 1},
            },
        )
    )
    async with PolarAsync("token", organization_id="org") as polar:
        monkeypatch.setattr(polar._client, "send_request", send)
        async with polar.metering(queue=MemoryEventQueue(polar)) as metering:
            if external:
                actor = await metering.actor(external_customer_id="external")
                result = await actor.meter("meter")
            else:
                result = await metering.meter(meter_id="meter", customer_id="customer")
    if missing:
        assert result is None
    else:
        assert result == CustomerMeter(
            meter_id="meter",
            customer_id="customer",
            consumed_units=3,
            credited_units=10,
            balance=7,
        )
    request = send.call_args.args[0]
    assert request.url.path == "/v1/customer-meters/"
    assert request.url.params["meter_id"] == "meter"
    key = "external_customer_id" if external else "customer_id"
    assert request.url.params[key] == ("external" if external else "customer")
    assert request.headers["Authorization"] == "Bearer token"
    assert request.headers["Polar-Organization"] == "org"


@pytest.mark.anyio
async def test_meter_api_error_propagates(monkeypatch: pytest.MonkeyPatch) -> None:
    async with PolarAsync("token") as polar:
        monkeypatch.setattr(
            polar._client,
            "send_request",
            AsyncMock(return_value=httpx2.Response(403, text="Forbidden")),
        )
        async with polar.metering(queue=MemoryEventQueue(polar)) as metering:
            with pytest.raises(PolarClientError):
                await metering.meter(meter_id="meter", external_customer_id="customer")


@pytest.mark.anyio
async def test_uses_active_queue_returned_by_open() -> None:
    queue = MagicMock(spec=EventQueue)
    active = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = active

    async with PolarAsync("token") as polar, polar.metering(queue=queue) as metering:
        await metering.track(name="usage", external_customer_id="alice")
        await metering.flush()

    active.enqueue.assert_awaited_once()
    active.flush.assert_awaited_once_with(timeout=30.0)
    queue.enqueue.assert_not_awaited()
    queue.flush.assert_not_awaited()


@pytest.mark.anyio
async def test_flush_enforces_timeout_for_custom_queue() -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    queue.flush = AsyncMock()

    async def flush(*, timeout: float = 30.0) -> None:
        await anyio.sleep_forever()

    queue.flush.side_effect = flush
    async with (
        PolarAsync("token") as polar,
        polar.metering(queue=queue) as metering,
    ):
        with anyio.fail_after(1), pytest.raises(MeteringTimeoutError):
            await metering.flush(timeout=0.01)


@pytest.mark.anyio
async def test_context_preserves_body_and_delivery_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body_error = ValueError("body failed")
    delivery_error = PolarClientError(422, "rejected")
    async with PolarAsync("token") as polar:
        monkeypatch.setattr(
            polar.events, "ingest", AsyncMock(side_effect=delivery_error)
        )
        with pytest.raises(ExceptionGroup) as failure:
            async with polar.metering() as metering:
                assert isinstance(metering.queue, MemoryEventQueue)
                assert metering.queue is not polar.metering().queue
                await metering.track(name="usage", external_customer_id="customer")
                raise body_error
    assert failure.value.exceptions[0] is body_error
    delivery = failure.value.exceptions[1]
    assert isinstance(delivery, MeteringDeliveryError)
    assert delivery.failures[0].cause is delivery_error


@pytest.mark.anyio
async def test_metering_wires_hooks_and_reduces_the_enqueued_event(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    consumed = CustomerMeter(meter_id="meter", consumed_units=3, credited_units=10, balance=7)
    monkeypatch.setattr(Outpost, "__aenter__", AsyncMock(side_effect=lambda outpost: outpost))
    monkeypatch.setattr(Outpost, "__aexit__", AsyncMock())
    track, ack, rejected = AsyncMock(), AsyncMock(), AsyncMock()
    monkeypatch.setattr(Outpost, "track", track)
    monkeypatch.setattr(Outpost, "actor", AsyncMock())
    monkeypatch.setattr(Outpost, "on_ack", ack)
    monkeypatch.setattr(Outpost, "on_rejected", rejected)
    monkeypatch.setattr(Outpost, "meter", AsyncMock(return_value=consumed))

    polar = PolarAsync("token")
    metering = polar.metering(queue=queue, outpost={"redis_url": "redis://localhost"})
    async with metering:
        assert metering.outpost is not None
        actor = await metering.actor(external_customer_id="alice")
        await actor.track(name="usage")
        event = queue.enqueue.await_args.args[0]
        assert event["external_id"]
        assert datetime.datetime.fromisoformat(event["timestamp"]).tzinfo is not None
        track.assert_awaited_once_with(event)
        queue.open.assert_called_once_with(on_ack=ack, on_rejected=rejected)
        hooks = queue.open.call_args.kwargs
        await hooks["on_ack"]([event])
        await hooks["on_rejected"]([event], "permanent_error")
        ack.assert_awaited_once_with([event])
        rejected.assert_awaited_once_with([event], "permanent_error")
        assert await actor.meter("meter") == consumed


@pytest.mark.anyio
async def test_enqueue_failure_skips_reduction_and_reduction_failure_is_logged(
    caplog: pytest.LogCaptureFixture,
) -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    outpost = AsyncMock(spec=Outpost)
    outpost.__aenter__.return_value = outpost
    async with Metering(queue, client=AsyncMock(spec=AsyncClientBase), outpost=outpost) as metering:
        queue.enqueue.side_effect = RuntimeError("enqueue failed")
        with pytest.raises(RuntimeError, match="enqueue failed"):
            await metering.track(name="usage", external_customer_id="alice")
        outpost.track.assert_not_awaited()

        queue.enqueue.side_effect = None
        failure = UnavailableRedisError()
        failure.__cause__ = RuntimeError("private event details")
        outpost.track.side_effect = failure
        await metering.track(name="usage", external_customer_id="alice")
        assert "Outpost failed to reduce an enqueued event (UnavailableRedisError)" in caplog.messages
        assert "private event details" not in caplog.text


@pytest.mark.anyio
async def test_meter_uses_api_when_outpost_cannot_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    outpost = AsyncMock(spec=Outpost)
    outpost.__aenter__.return_value = outpost
    outpost.meter.side_effect = NotReadyError("no snapshot yet")
    async with PolarAsync("token") as polar:
        send = AsyncMock(return_value=httpx2.Response(200, json={"items": []}))
        monkeypatch.setattr(polar._client, "send_request", send)
        async with Metering(queue, client=polar._client, outpost=outpost) as metering:
            assert await metering.meter("meter", external_customer_id="alice") is None
        send.assert_awaited_once()


def test_factory_requires_outpost_url() -> None:
    polar = PolarAsync("token")
    with pytest.raises(MeteringError, match="Outpost requires redis_url or REDIS_URL"):
        polar.metering(queue=MemoryEventQueue(polar), outpost=True)
