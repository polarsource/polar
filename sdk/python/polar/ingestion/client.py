import typing

from polar.base import AsyncClientBase
from polar.ingestion.events import EventInput


class EventsClient(typing.Protocol):
    async def ingest(self, *, events: list[EventInput]) -> object: ...


class IngestionClient(typing.Protocol):
    @property
    def events(self) -> EventsClient: ...


class PolarClient(IngestionClient, typing.Protocol):
    @property
    def _client(self) -> AsyncClientBase: ...
