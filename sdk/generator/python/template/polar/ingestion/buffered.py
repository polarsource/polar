import contextlib
import math
import random
import types
import typing

import anyio

from polar import PolarError, PolarNetworkError, PolarRateLimitError, PolarServerError
from polar.ingestion.client import IngestionClient
from polar.ingestion.events import EventInput
from polar.logging import get_logger

log = get_logger(__name__)


def _jittered_delay(base: float, jitter: float = 0.1) -> float:
    return base * (1 + random.uniform(-jitter, jitter))


DropReason = typing.Literal["retry_exhausted", "shutdown_timeout", "permanent_error"]


class BufferedIngestionStrategy:
    def __init__(
        self,
        polar: IngestionClient,
        batch_size: int = 100,
        batch_interval: float = 1.0,
        shutdown_timeout: float = 5.0,
        max_attempts: int = 3,
        on_dropped: typing.Callable[
            [list[EventInput], DropReason], typing.Awaitable[None]
        ]
        | None = None,
    ) -> None:
        if batch_size <= 0:
            raise ValueError("batch_size must be greater than zero")
        self.polar = polar
        self.batch_size = batch_size
        self.batch_interval = batch_interval
        self.shutdown_timeout = shutdown_timeout
        self.max_attempts = max_attempts
        self.on_dropped = on_dropped
        self._send_queue, self._receive_queue = anyio.create_memory_object_stream[
            EventInput
        ](math.inf)
        self._stack = contextlib.AsyncExitStack()

    async def __aenter__(self) -> typing.Self:
        self._flush_task_handle = await self._stack.enter_async_context(
            anyio.create_task_group()
        )
        self._flush_cancel_scope = await self._flush_task_handle.start(self._flush_task)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: types.TracebackType | None,
    ) -> bool | None:
        self._flush_task_handle.cancel_scope.shield = True
        self._flush_cancel_scope.deadline = anyio.current_time() + self.shutdown_timeout
        self._send_queue.close()
        await self._stack.aclose()

    async def ingest(
        self,
        event: EventInput,
    ) -> None:
        await self._send_queue.send(event)

    async def _on_dropped(self, events: list[EventInput], reason: DropReason) -> None:
        log.warning("Dropping %s events: %s", len(events), reason)
        if self.on_dropped is not None:
            await self.on_dropped(events, reason)

    async def _flush_task(
        self, *, task_status: anyio.abc.TaskStatus[anyio.CancelScope]
    ) -> None:
        async with self._receive_queue:
            batch: list[EventInput] = []
            with anyio.CancelScope(shield=True) as cancel_scope:
                task_status.started(cancel_scope)
                stream_closed = False
                while not stream_closed:
                    batch = []
                    try:
                        with anyio.move_on_after(self.batch_interval):
                            while len(batch) < self.batch_size:
                                event = await self._receive_queue.receive()
                                batch.append(event)
                    except anyio.EndOfStream:
                        stream_closed = True

                    if batch:
                        await self._process_batch(batch)
                        batch = []

            if cancel_scope.cancelled_caught:
                while True:
                    try:
                        batch.append(self._receive_queue.receive_nowait())
                    except anyio.EndOfStream:
                        break
                if batch:
                    await self._on_dropped(batch, "shutdown_timeout")

    async def _process_batch(self, batch: list[EventInput], attempt: int = 1) -> None:
        try:
            await self.polar.events.ingest(events=batch)
        except (PolarNetworkError, PolarRateLimitError, PolarServerError) as e:
            if attempt >= self.max_attempts:
                await self._on_dropped(batch, "retry_exhausted")
                return
            if isinstance(e, PolarRateLimitError) and e.retry_after is not None:
                retry_after = e.retry_after
            else:
                retry_after = _jittered_delay(2**attempt)
            await anyio.sleep(retry_after)
            return await self._process_batch(batch, attempt=attempt + 1)
        except PolarError:
            await self._on_dropped(batch, "permanent_error")
            return
