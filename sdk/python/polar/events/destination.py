import typing
from collections.abc import Sequence

from .types import Event


class DestinationProtocol(typing.Protocol):
    def ingest(self, events: Sequence[Event]) -> None: ...
