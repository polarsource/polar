import datetime
import subprocess
import sys
import typing
from unittest.mock import AsyncMock, MagicMock

import anyio
import httpx2
import pytest

from polar import PolarClientError
from polar.metering.errors import (
    IngestRejectedError,
    MeteringDeliveryError,
    MeteringTimeoutError,
)
from polar.metering.meter import CustomerMeter
from polar.metering.queue import EventQueue
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
    async with PolarAsync("token", event_queue=queue) as polar:
        with pytest.raises(ValueError):
            polar.actor(**identity)

        with pytest.raises(ValueError):
            await polar.track(name="usage", **identity)
        queue.enqueue.assert_not_awaited()


def test_actor_without_outpost_dependencies() -> None:
    subprocess.run(
        [
            sys.executable,
            "-c",
            """
import asyncio
import sys
import typing
import httpx2

sys.modules["polar.outpost"] = None
sys.modules["redis"] = None
sys.modules["opentelemetry"] = None

from polar.{{ ir.versions[0] | format_version }} import PolarAsync

assert "outpost" in typing.get_type_hints(PolarAsync.__init__)

async def main():
    async with PolarAsync("token") as polar:
        async def post(*args, **kwargs):
            return httpx2.Response(202, request=httpx2.Request("POST", "https://polar.test"))
        polar._client._client.post = post
        actor = polar.actor(external_customer_id="customer")
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
        if external:
            actor = polar.actor(external_customer_id="external")
            result = await actor.meter("meter")
        else:
            result = await polar.meter(meter_id="meter", customer_id="customer")
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
        with pytest.raises(PolarClientError):
            await polar.meter(meter_id="meter", external_customer_id="customer")


@pytest.mark.anyio
async def test_uses_active_queue_returned_by_open() -> None:
    queue = MagicMock(spec=EventQueue)
    active = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = active

    async with PolarAsync("token", event_queue=queue) as polar:
        await polar.track(name="usage", external_customer_id="alice")
        await polar.flush()

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
    async with PolarAsync("token", event_queue=queue) as polar:
        with anyio.fail_after(1), pytest.raises(MeteringTimeoutError):
            await polar.flush(timeout=0.01)


@pytest.mark.anyio
async def test_context_preserves_body_and_delivery_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body_error = ValueError("body failed")
    response = httpx2.Response(
        422,
        text="rejected",
        request=httpx2.Request("POST", "https://polar.test/v1/events/ingest"),
    )
    with pytest.raises(ExceptionGroup) as failure:
        async with PolarAsync("token", event_queue=MemoryEventQueue()) as polar:
            monkeypatch.setattr(polar._client._client, "post", AsyncMock(return_value=response))
            await polar.track(name="usage", external_customer_id="customer")
            raise body_error
    assert failure.value.exceptions[0] is body_error
    delivery = failure.value.exceptions[1]
    assert isinstance(delivery, MeteringDeliveryError)
    cause = delivery.failures[0].cause
    assert isinstance(cause, IngestRejectedError)
    assert isinstance(cause.__cause__, httpx2.HTTPStatusError)
    assert cause.__cause__.response is response


@pytest.mark.anyio
@pytest.mark.parametrize("status", [202, 422])
async def test_metering_reports_delivery_outcomes_without_outpost(
    status: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    response = httpx2.Response(
        status, request=httpx2.Request("POST", "https://polar.test/v1/events/ingest")
    )
    on_ack, on_rejected = AsyncMock(), AsyncMock()
    async with PolarAsync("token", on_event_ack=on_ack, on_event_rejected=on_rejected) as polar:
        post = AsyncMock(return_value=response)
        monkeypatch.setattr(polar._client._client, "post", post)
        await polar.track(name="usage", external_customer_id="alice")
        if status == 202:
            await polar.flush()
            assert post.await_args is not None
            on_ack.assert_awaited_once_with(post.await_args.kwargs["json"]["events"])
            on_rejected.assert_not_awaited()
        else:
            with pytest.raises(MeteringDeliveryError) as failure:
                await polar.flush()
            on_rejected.assert_awaited_once_with(failure.value.events, "permanent_error")
            on_ack.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("hook_fails", [False, True])
async def test_metering_wires_hooks_and_reduces_the_enqueued_event(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    hook_fails: bool,
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

    caller_error = RuntimeError("private event data") if hook_fails else None
    caller_ack = AsyncMock(side_effect=caller_error)
    caller_rejected = AsyncMock(side_effect=caller_error)
    hooks_order = MagicMock()
    hooks_order.attach_mock(caller_ack, "caller_ack")
    hooks_order.attach_mock(ack, "outpost_ack")
    hooks_order.attach_mock(caller_rejected, "caller_rejected")
    hooks_order.attach_mock(rejected, "outpost_rejected")

    async with PolarAsync(
        "token", event_queue=queue, outpost={"redis": "redis://localhost"},
        on_event_ack=caller_ack, on_event_rejected=caller_rejected,
    ) as polar:
        actor = polar.actor(external_customer_id="alice")
        await actor.track(name="usage")
        event = queue.enqueue.await_args.args[0]
        assert event["external_id"]
        assert datetime.datetime.fromisoformat(event["timestamp"]).tzinfo is not None
        track.assert_awaited_once_with(event)
        queue.open.assert_called_once_with(
            ingest=polar._ingest, on_ack=polar._on_ack, on_rejected=polar._on_rejected
        )
        hooks = queue.open.call_args.kwargs
        await hooks["on_ack"]([event])
        await hooks["on_rejected"]([event], "permanent_error")
        ack.assert_awaited_once_with([event])
        rejected.assert_awaited_once_with([event], "permanent_error")
        assert [entry[0] for entry in hooks_order.mock_calls] == [
            "outpost_ack", "caller_ack", "outpost_rejected", "caller_rejected"
        ]
        caller_ack.assert_awaited_once_with([event])
        caller_rejected.assert_awaited_once_with([event], "permanent_error")
        assert await actor.meter("meter") == consumed
    if hook_fails:
        assert "Event acknowledgement hook failed (RuntimeError)" in caplog.messages
        assert "Event rejection hook failed (RuntimeError)" in caplog.messages
        assert "private event data" not in caplog.text


@pytest.mark.anyio
async def test_enqueue_failure_skips_reduction_and_reduction_failure_is_logged(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    outpost = AsyncMock(spec=Outpost)
    monkeypatch.setattr(Outpost, "create", MagicMock(return_value=outpost))
    outpost.__aenter__.return_value = outpost
    async with PolarAsync("token", event_queue=queue, outpost={"redis": "redis://localhost"}) as polar:
        queue.enqueue.side_effect = RuntimeError("enqueue failed")
        with pytest.raises(RuntimeError, match="enqueue failed"):
            await polar.track(name="usage", external_customer_id="alice")
        outpost.track.assert_not_awaited()

        queue.enqueue.side_effect = None
        failure = UnavailableRedisError()
        failure.__cause__ = RuntimeError("private event details")
        outpost.track.side_effect = failure
        await polar.track(name="usage", external_customer_id="alice")
        assert "Outpost failed to reduce an enqueued event (UnavailableRedisError)" in caplog.messages
        assert "private event details" not in caplog.text


@pytest.mark.anyio
async def test_meter_uses_api_when_outpost_cannot_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    outpost = AsyncMock(spec=Outpost)
    monkeypatch.setattr(Outpost, "create", MagicMock(return_value=outpost))
    outpost.__aenter__.return_value = outpost
    outpost.meter.side_effect = NotReadyError("no snapshot yet")
    async with PolarAsync("token", event_queue=None, outpost={"redis": "redis://localhost"}) as polar:
        send = AsyncMock(return_value=httpx2.Response(200, json={"items": []}))
        monkeypatch.setattr(polar._client, "send_request", send)
        assert await polar.actor(external_customer_id="alice").meter("meter") is None
        with pytest.raises(RuntimeError, match="Configure an event_queue"):
            await polar.actor(external_customer_id="alice").track(name="usage")
        outpost.track.assert_not_awaited()
        send.assert_awaited_once()
    outpost.__aenter__.assert_awaited_once()
    outpost.__aexit__.assert_awaited_once()


@pytest.mark.anyio
async def test_track_requires_open_queue() -> None:
    polar = PolarAsync("token", event_queue=MemoryEventQueue())
    with pytest.raises(RuntimeError, match="Use async with PolarAsync"):
        await polar.track(name="usage", external_customer_id="alice")
    async with polar:
        pass
    with pytest.raises(RuntimeError, match="Use async with PolarAsync"):
        await polar.track(name="usage", external_customer_id="alice")


@pytest.mark.anyio
async def test_queue_startup_failure_closes_outpost_and_http_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue = MagicMock(spec=EventQueue)
    queue.open.return_value.__aenter__.side_effect = RuntimeError("queue failed")
    outpost = AsyncMock(spec=Outpost)
    monkeypatch.setattr(Outpost, "create", MagicMock(return_value=outpost))
    polar = PolarAsync("token", event_queue=queue, outpost={"redis": "redis://localhost"})

    with pytest.raises(RuntimeError, match="queue failed"):
        async with polar:
            pytest.fail("Client started despite queue startup failure")

    outpost.__aexit__.assert_awaited_once()
    assert polar._client._client.is_closed
