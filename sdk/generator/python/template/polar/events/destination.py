from collections.abc import Sequence
import typing

from .types import Event


class DestinationProtocol(typing.Protocol):
    def ingest(self, events: Sequence[Event]) -> None:
        ...
