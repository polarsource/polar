import collections.abc
import types
import typing

from polar.metering.errors import DropReason
from polar.metering.events import EventInput

OnAck = collections.abc.Callable[[list[EventInput]], collections.abc.Awaitable[None]]
OnRejected = collections.abc.Callable[
    [list[EventInput], DropReason], collections.abc.Awaitable[None]
]


class Outbox(typing.Protocol):
    on_ack: OnAck | None
    on_rejected: OnRejected | None

    async def __aenter__(self) -> typing.Self: ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: types.TracebackType | None,
    ) -> None: ...

    async def enqueue(self, event: EventInput) -> None: ...

    async def flush(self, *, timeout: float = 30.0) -> None: ...
