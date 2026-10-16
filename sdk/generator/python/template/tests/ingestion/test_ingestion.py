from unittest.mock import AsyncMock

import httpx
import pytest

from polar.ingestion import EventInput, Ingestion
from polar.ingestion.buffered import BufferedIngestionStrategy
from polar.outpost import Outpost
from polar.{{ ir.versions[0] | format_version }} import PolarAsync


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

            await ingestion.ingest(event)

            for _, _, ingest in mocks:
                ingest.assert_awaited_once_with(event)

        for _, exit, _ in mocks:
            exit.assert_awaited_once()
