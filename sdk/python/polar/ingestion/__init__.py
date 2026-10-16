import contextlib
import types
import typing

from polar.ingestion.buffered import (
    BufferedIngestionStrategy as BufferedIngestionStrategy,
)
from polar.ingestion.client import IngestionClient, PolarClient
from polar.ingestion.events import EventInput
from polar.logging import get_logger

log = get_logger(__name__)


class IngestionStrategyProtocol(
    contextlib.AbstractAsyncContextManager["IngestionStrategyProtocol"], typing.Protocol
):
    async def ingest(self, event: EventInput) -> None: ...


class Ingestion:
    def __init__(self, strategies: list[IngestionStrategyProtocol]) -> None:
        self.strategies = strategies
        self._stack = contextlib.AsyncExitStack()

    async def __aenter__(self) -> typing.Self:
        try:
            for strategy in self.strategies:
                await self._stack.enter_async_context(strategy)
        except BaseException:
            await self._stack.aclose()
            raise
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: types.TracebackType | None,
    ) -> bool | None:
        await self._stack.aclose()

    async def ingest(self, event: EventInput) -> None:
        for strategy in self.strategies:
            await strategy.ingest(event)

    @classmethod
    def create(
        cls, polar: PolarClient, outpost_redis_url: str | None = None
    ) -> typing.Self:
        strategies: list[IngestionStrategyProtocol] = [BufferedIngestionStrategy(polar)]
        if outpost_redis_url is not None:
            from polar.outpost import Outpost

            strategies.append(Outpost.create(polar, outpost_redis_url))
        return cls(strategies=strategies)


__all__ = ["EventInput", "Ingestion", "IngestionClient", "PolarClient"]
