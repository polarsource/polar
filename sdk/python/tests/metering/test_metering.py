import subprocess
import sys
import typing
from unittest.mock import AsyncMock

import anyio
import anyio.lowlevel
import httpx
import pytest

from polar import PolarClientError, PolarError, PolarNetworkError
from polar.base import AsyncClientBase
from polar.metering import (
    BufferedMeteringOptions,
    CustomerMeter,
    EventInput,
    FlushProtocol,
    InvalidActorError,
    Metering,
    MeteringError,
    MeteringOutpostOptions,
    MeteringStrategyProtocol,
)
from polar.metering.buffered import BufferedMeteringStrategy
from polar.outpost import Outpost
from polar.v2026_04 import PolarAsync


@pytest.mark.anyio
@pytest.mark.parametrize("fail", [False, True])
async def test_flush_optional_strategies(fail: bool) -> None:
    ordinary = AsyncMock(spec=MeteringStrategyProtocol)
    first = AsyncMock(spec=MeteringStrategyProtocol)
    first.flush = AsyncMock()
    second = AsyncMock(spec=MeteringStrategyProtocol)
    second.flush = AsyncMock()
    error = RuntimeError("flush failed")
    if fail:
        first.flush.side_effect = error
    assert isinstance(first, FlushProtocol)
    assert not isinstance(ordinary, FlushProtocol)
    async with (
        PolarAsync("token") as polar,
        polar.metering(strategies=[first, ordinary, second]) as metering,
    ):
        if fail:
            with pytest.raises(ExceptionGroup) as exc_info:
                await metering.flush()
            assert exc_info.value.exceptions == (error,)
        else:
            await metering.flush()
        first.flush.assert_awaited_once_with()
        second.flush.assert_awaited_once_with()
        first.__aexit__.assert_not_awaited()
        await metering.ingest(name="usage", external_customer_id="customer")
        first.ingest.assert_awaited_once()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "environment, outpost_options, expected_url",
    [
        (None, None, None),
        ("", None, None),
        ("redis://environment:6379", None, "redis://environment:6379"),
        ("redis://environment:6379", {}, "redis://environment:6379"),
        ("redis://environment:6379", False, None),
        (None, {"redis_url": "redis://explicit:6379"}, "redis://explicit:6379"),
        (
            "redis://environment:6379",
            {"redis_url": "redis://explicit:6379"},
            "redis://explicit:6379",
        ),
    ],
)
async def test_factory_outpost_configuration(
    monkeypatch: pytest.MonkeyPatch,
    environment: str | None,
    outpost_options: MeteringOutpostOptions | typing.Literal[False] | None,
    expected_url: str | None,
) -> None:
    if environment is not None:
        monkeypatch.setenv("REDIS_URL", environment)
    enter = AsyncMock()
    exit = AsyncMock()
    monkeypatch.setattr(Outpost, "__aenter__", enter)
    monkeypatch.setattr(Outpost, "__aexit__", exit)
    async with PolarAsync("token") as polar:
        metering = polar.metering(outpost=outpost_options)
        monkeypatch.setenv("REDIS_URL", "redis://changed:6379")
        async with metering:
            assert isinstance(metering.strategies[0], BufferedMeteringStrategy)
            assert len(metering.strategies) == (2 if expected_url else 1)
            if expected_url:
                outpost = metering.strategies[1]
                assert isinstance(outpost, Outpost)
                assert outpost.redis_url == expected_url
                assert outpost._client is polar._client._client
    assert enter.await_count == (1 if expected_url else 0)
    assert exit.await_count == (1 if expected_url else 0)


@pytest.mark.anyio
@pytest.mark.parametrize("outpost", [{}, {"redis_url": ""}])
async def test_factory_requires_outpost_url(outpost: MeteringOutpostOptions) -> None:
    async with PolarAsync("token") as polar:
        with pytest.raises(
            MeteringError, match="Outpost requires redis_url or REDIS_URL"
        ):
            polar.metering(outpost=outpost)


@pytest.mark.anyio
@pytest.mark.parametrize("options", [{"buffered": {}}, {"outpost": False}])
async def test_factory_rejects_mixed_configuration(
    options: dict[str, typing.Any],
) -> None:
    async with PolarAsync("token") as polar:
        with pytest.raises(MeteringError, match="Cannot combine strategies"):
            polar.metering(strategies=[], **options)


@pytest.mark.anyio
@pytest.mark.parametrize("empty", [False, True])
async def test_factory_explicit_strategies(
    monkeypatch: pytest.MonkeyPatch, empty: bool
) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://environment:6379")
    strategy = AsyncMock(spec=MeteringStrategyProtocol)
    strategies: list[MeteringStrategyProtocol] = [] if empty else [strategy]
    async with (
        PolarAsync("token") as polar,
        polar.metering(strategies=strategies) as metering,
    ):
        assert metering.strategies == strategies
        assert metering._client is polar._client
        await metering.ingest(name="usage", external_customer_id="customer")
    assert strategy.__aenter__.await_count == (0 if empty else 1)
    assert strategy.ingest.await_count == (0 if empty else 1)
    assert strategy.__aexit__.await_count == (0 if empty else 1)


@pytest.mark.anyio
async def test_factory_buffer_options(monkeypatch: pytest.MonkeyPatch) -> None:
    on_dropped = AsyncMock()
    async with PolarAsync("token") as polar:
        send = AsyncMock(side_effect=PolarNetworkError("offline"))
        monkeypatch.setattr(polar.events, "ingest", send)
        async with polar.metering(
            buffered=BufferedMeteringOptions(
                batch_size=1, batch_interval=60, max_attempts=1, on_dropped=on_dropped
            )
        ) as metering:
            await metering.ingest(name="usage", external_customer_id="customer")
            with anyio.fail_after(1):
                while not on_dropped.await_count:
                    await anyio.lowlevel.checkpoint()
        send.assert_awaited_once()
        on_dropped.assert_awaited_once_with(
            [{"name": "usage", "external_customer_id": "customer"}], "retry_exhausted"
        )


@pytest.mark.anyio
async def test_factory_outpost_options_and_startup_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    enter = AsyncMock(side_effect=RuntimeError("Redis unavailable"))
    monkeypatch.setattr(Outpost, "__aenter__", enter)
    async with PolarAsync("token") as polar:
        metering = polar.metering(
            outpost=MeteringOutpostOptions(
                redis_url="redis://localhost:6379", telemetry=False
            )
        )
        outpost = metering.strategies[1]
        assert isinstance(outpost, Outpost)
        assert not outpost._telemetry
        with pytest.raises(RuntimeError, match="Redis unavailable"):
            async with metering:
                pytest.fail("Startup should have failed")
        with pytest.raises(anyio.ClosedResourceError):
            await metering.strategies[0].ingest(
                {"name": "usage", "external_customer_id": "customer"}
            )


@pytest.mark.anyio
async def test_metering_enters_and_calls_both_strategies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with PolarAsync("token") as polar, httpx.AsyncClient() as client:
        buffered = BufferedMeteringStrategy(polar)
        outpost = Outpost("redis://localhost:6379", client=client)
        mocks: list[tuple[AsyncMock, AsyncMock, AsyncMock]] = []
        for strategy in (buffered, outpost):
            enter = AsyncMock(return_value=strategy)
            exit = AsyncMock(return_value=None)
            ingest = AsyncMock()
            monkeypatch.setattr(type(strategy), "__aenter__", enter)
            monkeypatch.setattr(type(strategy), "__aexit__", exit)
            monkeypatch.setattr(strategy, "ingest", ingest)
            mocks.append((enter, exit, ingest))

        event: EventInput = {"name": "usage", "external_customer_id": "customer"}
        async with Metering(
            strategies=[buffered, outpost], client=polar._client
        ) as metering:
            for enter, exit, ingest in mocks:
                enter.assert_awaited_once()
                exit.assert_not_awaited()
                ingest.assert_not_awaited()

            await metering.ingest(**event)

            for _, _, ingest in mocks:
                ingest.assert_awaited_once_with(event)

        for _, exit, _ in mocks:
            exit.assert_awaited_once()


@pytest.mark.anyio
async def test_failed_strategy_startup_closes_buffered_strategy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    event: EventInput = {"name": "usage", "external_customer_id": "customer"}
    async with PolarAsync("token") as polar, httpx.AsyncClient() as client:
        ingest = AsyncMock()
        monkeypatch.setattr(polar.events, "ingest", ingest)
        buffered = BufferedMeteringStrategy(polar, batch_interval=60)
        outpost = Outpost("redis://localhost:6379", client=client)

        async def fail_startup(self: Outpost) -> Outpost:
            await buffered.ingest(event)
            raise RuntimeError("startup failed")

        monkeypatch.setattr(Outpost, "__aenter__", fail_startup)
        with anyio.fail_after(1):
            with pytest.raises(RuntimeError, match="startup failed"):
                async with Metering(
                    strategies=[buffered, outpost], client=polar._client
                ):
                    pytest.fail("Startup should have failed")

        ingest.assert_awaited_once_with(events=[event])
        with pytest.raises(anyio.ClosedResourceError):
            await buffered.ingest(event)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "identity",
    [
        {"customer_id": "customer", "member_id": None},
        {"customer_id": "customer", "member_id": "member"},
        {"external_customer_id": "customer", "external_member_id": None},
        {"external_customer_id": "customer", "external_member_id": "member"},
    ],
)
async def test_actor_metering(identity: dict[str, typing.Any]) -> None:
    strategy = AsyncMock(spec=MeteringStrategyProtocol)
    strategy.actor = AsyncMock()
    ordinary_strategy = AsyncMock(spec=MeteringStrategyProtocol)
    async with Metering(
        strategies=[ordinary_strategy, strategy], client=AsyncMock(spec=AsyncClientBase)
    ) as metering:
        actor = await metering.actor(**identity)
        strategy.actor.assert_awaited_once_with(
            customer_id=identity.get("customer_id"),
            external_customer_id=identity.get("external_customer_id"),
        )
        await actor.ingest(name="usage", metadata={"tokens": 3})
        expected_event = {**identity, "name": "usage", "metadata": {"tokens": 3}}
        strategy.ingest.assert_awaited_once_with(expected_event)
        ordinary_strategy.ingest.assert_awaited_once_with(expected_event)

        strategy.ingest.reset_mock()
        await metering.ingest(name="usage", metadata={"tokens": 3}, **identity)
        strategy.ingest.assert_awaited_once_with(expected_event)


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
    strategy = AsyncMock(spec=MeteringStrategyProtocol)
    strategy.actor = AsyncMock()
    async with Metering(
        strategies=[strategy], client=AsyncMock(spec=AsyncClientBase)
    ) as metering:
        with pytest.raises(InvalidActorError) as exc_info:
            await metering.actor(**identity)
        assert isinstance(exc_info.value, MeteringError)
        assert isinstance(exc_info.value, PolarError)

        with pytest.raises(InvalidActorError):
            await metering.ingest(name="usage", **identity)
        strategy.ingest.assert_not_awaited()
        strategy.actor.assert_not_awaited()


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
sys.modules["httpx_ws"] = None
sys.modules["opentelemetry"] = None

from polar.base import AsyncClientBase
from polar.metering import Metering
from polar.metering.buffered import BufferedMeteringStrategy

async def main():
    async with Metering(
        strategies=[BufferedMeteringStrategy(AsyncMock())],
        client=AsyncMock(spec=AsyncClientBase),
    ) as metering:
        actor = await metering.actor(external_customer_id="customer")
        await actor.ingest(name="usage")

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
        return_value=httpx.Response(
            200,
            json={
                "items": [] if missing else [value],
                "pagination": {"total_count": 1, "max_page": 1},
            },
        )
    )
    async with PolarAsync("token", organization_id="org") as polar:
        monkeypatch.setattr(polar._client, "send_request", send)
        async with polar.metering() as metering:
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
@pytest.mark.parametrize(
    "result",
    [
        CustomerMeter(meter_id="meter", consumed_units=3, credited_units=10, balance=7),
        None,
        RuntimeError("read failed"),
    ],
)
async def test_meter_strategy_is_authoritative(
    result: CustomerMeter | None | Exception,
) -> None:
    ordinary = AsyncMock(spec=MeteringStrategyProtocol)
    strategy = AsyncMock(spec=MeteringStrategyProtocol)
    strategy.meter = AsyncMock()
    if isinstance(result, Exception):
        strategy.meter.side_effect = result
    else:
        strategy.meter.return_value = result
    second = AsyncMock(spec=MeteringStrategyProtocol)
    second.meter = AsyncMock()
    async with Metering(
        strategies=[ordinary, strategy, second], client=AsyncMock(spec=AsyncClientBase)
    ) as metering:
        actor = await metering.actor(customer_id="customer", member_id="member")
        if isinstance(result, Exception):
            with pytest.raises(RuntimeError, match="read failed"):
                await actor.meter("meter")
        else:
            assert await actor.meter("meter") is result
    strategy.meter.assert_awaited_once_with(
        meter_id="meter", customer_id="customer", external_customer_id=None
    )
    second.meter.assert_not_awaited()


@pytest.mark.anyio
async def test_meter_api_error_propagates(monkeypatch: pytest.MonkeyPatch) -> None:
    async with PolarAsync("token") as polar:
        monkeypatch.setattr(
            polar._client,
            "send_request",
            AsyncMock(return_value=httpx.Response(403, text="Forbidden")),
        )
        async with polar.metering() as metering:
            with pytest.raises(PolarClientError):
                await metering.meter(meter_id="meter", external_customer_id="customer")
