import collections.abc
import contextlib
import typing

from polar.metering.errors import DropReason
from polar.metering.events import EventInput

Ingest = collections.abc.Callable[[list[EventInput]], collections.abc.Awaitable[None]]
OnAck = collections.abc.Callable[[list[EventInput]], collections.abc.Awaitable[None]]
OnRejected = collections.abc.Callable[
    [list[EventInput], DropReason], collections.abc.Awaitable[None]
]


class EventQueue(typing.Protocol):
    def open(
        self,
        *,
        ingest: Ingest,
        on_ack: OnAck | None = None,
        on_rejected: OnRejected | None = None,
    ) -> contextlib.AbstractAsyncContextManager["EventQueue"]: ...

    async def enqueue(self, event: EventInput) -> None: ...

    async def flush(self, *, timeout: float = 30.0) -> None: ...
