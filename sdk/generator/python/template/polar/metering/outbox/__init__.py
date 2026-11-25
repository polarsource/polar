import types
import typing

from polar.metering.events import EventInput


class Outbox(typing.Protocol):
    async def __aenter__(self) -> typing.Self: ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: types.TracebackType | None,
    ) -> None: ...

    async def enqueue(self, event: EventInput) -> None: ...

    async def flush(self, *, timeout: float = 30.0) -> None: ...
