import typing

from polar.base import AsyncClientBase
from polar.metering.events import EventInput


class EventsClient(typing.Protocol):
    async def ingest(self, *, events: list[EventInput]) -> object: ...


class MeteringClient(typing.Protocol):
    @property
    def events(self) -> EventsClient: ...


class PolarClient(MeteringClient, typing.Protocol):
    @property
    def _client(self) -> AsyncClientBase: ...
