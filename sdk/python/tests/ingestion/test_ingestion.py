import subprocess
import sys
import typing
from unittest.mock import AsyncMock

import anyio
import httpx
import pytest

from polar import PolarError
from polar.ingestion import (
    EventInput,
    Ingestion,
    IngestionError,
    IngestionStrategyProtocol,
    InvalidActorError,
)
from polar.ingestion.buffered import BufferedIngestionStrategy
from polar.outpost import Outpost
from polar.v2026_04 import PolarAsync


@pytest.mark.anyio
async def test_ingestion_enters_and_calls_both_strategies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with PolarAsync("token") as polar, httpx.AsyncClient() as client:
        buffered = BufferedIngestionStrategy(polar)
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
        async with Ingestion(strategies=[buffered, outpost]) as ingestion:
            for enter, exit, ingest in mocks:
                enter.assert_awaited_once()
                exit.assert_not_awaited()
                ingest.assert_not_awaited()

            await ingestion.ingest(**event)

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
        buffered = BufferedIngestionStrategy(polar, batch_interval=60)
        outpost = Outpost("redis://localhost:6379", client=client)

        async def fail_startup(self: Outpost) -> Outpost:
            await buffered.ingest(event)
            raise RuntimeError("startup failed")

        monkeypatch.setattr(Outpost, "__aenter__", fail_startup)
        with anyio.fail_after(1):
            with pytest.raises(RuntimeError, match="startup failed"):
                async with Ingestion(strategies=[buffered, outpost]):
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
async def test_actor_ingestion(identity: dict[str, typing.Any]) -> None:
    strategy = AsyncMock(spec=IngestionStrategyProtocol)
    strategy.actor = AsyncMock()
    ordinary_strategy = AsyncMock(spec=IngestionStrategyProtocol)
    async with Ingestion(strategies=[ordinary_strategy, strategy]) as ingestion:
        actor = await ingestion.actor(**identity)
        strategy.actor.assert_awaited_once_with(
            customer_id=identity.get("customer_id"),
            external_customer_id=identity.get("external_customer_id"),
        )
        await actor.ingest(name="usage", metadata={"tokens": 3})
        expected_event = {**identity, "name": "usage", "metadata": {"tokens": 3}}
        strategy.ingest.assert_awaited_once_with(expected_event)
        ordinary_strategy.ingest.assert_awaited_once_with(expected_event)

        strategy.ingest.reset_mock()
        await ingestion.ingest(name="usage", metadata={"tokens": 3}, **identity)
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
    strategy = AsyncMock(spec=IngestionStrategyProtocol)
    strategy.actor = AsyncMock()
    async with Ingestion(strategies=[strategy]) as ingestion:
        with pytest.raises(InvalidActorError) as exc_info:
            await ingestion.actor(**identity)
        assert isinstance(exc_info.value, IngestionError)
        assert isinstance(exc_info.value, PolarError)

        with pytest.raises(InvalidActorError):
            await ingestion.ingest(name="usage", **identity)
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

from polar.ingestion import Ingestion
from polar.ingestion.buffered import BufferedIngestionStrategy

async def main():
    async with Ingestion(strategies=[BufferedIngestionStrategy(AsyncMock())]) as ingestion:
        actor = await ingestion.actor(external_customer_id="customer")
        await actor.ingest(name="usage")

asyncio.run(main())
""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
