import contextlib
import dataclasses
import math
import random
import types
import typing

import anyio

from polar import PolarError, PolarNetworkError, PolarRateLimitError, PolarServerError
from polar.logging import get_logger
from polar.metering.client import MeteringClient
from polar.metering.events import EventInput

log = get_logger(__name__)


def _jittered_delay(base: float, jitter: float = 0.1) -> float:
    return base * (1 + random.uniform(-jitter, jitter))


DropReason = typing.Literal["retry_exhausted", "shutdown_timeout", "permanent_error"]

RETRY_AFTER_BUDGET = 300.0


class BufferedMeteringOptions(typing.TypedDict, total=False):
    """Configure in-memory batching and delivery to Polar.

    Attributes:
        batch_size: Maximum events per request. Defaults to 100.
        batch_interval: Seconds to collect a batch after its first event. Defaults to 1.
        shutdown_timeout: Seconds allowed to drain on exit. Defaults to 5.
        max_attempts: Total delivery attempts per batch, including the first. Defaults to 3.
        on_delivered: Async callback for events Polar accepted.
        on_dropped: Async callback for undelivered events and their DropReason.
            Defaults to None; drops are always logged.
    """

    batch_size: int
    batch_interval: float
    shutdown_timeout: float
    max_attempts: int
    on_delivered: typing.Callable[[list[EventInput]], typing.Awaitable[None]] | None
    on_dropped: (
        typing.Callable[[list[EventInput], DropReason], typing.Awaitable[None]] | None
    )


@dataclasses.dataclass
class _FlushRequest:
    completed: anyio.Event = dataclasses.field(default_factory=anyio.Event)
    error: BaseException | None = None


class BufferedMeteringStrategy:
    """Batch events in memory and deliver them through Polar's HTTP API."""

    def __init__(
        self,
        polar: MeteringClient,
        batch_size: int = 100,
        batch_interval: float = 1.0,
        shutdown_timeout: float = 5.0,
        max_attempts: int = 3,
        on_delivered: typing.Callable[[list[EventInput]], typing.Awaitable[None]]
        | None = None,
        on_dropped: typing.Callable[
            [list[EventInput], DropReason], typing.Awaitable[None]
        ]
        | None = None,
    ) -> None:
        """Configure event delivery and retries.

        Args:
            polar: Client exposing the events.ingest API.
            batch_size: Maximum events per request. Defaults to 100.
            batch_interval: Batch collection interval in seconds. Defaults to 1.
            shutdown_timeout: Drain deadline in seconds. Defaults to 5.
            max_attempts: Total attempts per batch. Defaults to 3.
            on_delivered: Awaited callback for events Polar accepted.
            on_dropped: Awaited callback for dropped events and the drop reason.

        Raises:
            ValueError: batch_size is not positive.
        """
        if batch_size <= 0:
            raise ValueError("batch_size must be greater than zero")
        self.polar = polar
        self.batch_size = batch_size
        self.batch_interval = batch_interval
        self.shutdown_timeout = shutdown_timeout
        self.max_attempts = max_attempts
        self.on_delivered = on_delivered
        self.on_dropped = on_dropped
        self._send_queue, self._receive_queue = anyio.create_memory_object_stream[
            EventInput | _FlushRequest
        ](math.inf)
        self._stack = contextlib.AsyncExitStack()
        self._flush_cancel_scope: anyio.CancelScope | None = None

    async def __aenter__(self) -> typing.Self:
        if self._flush_cancel_scope is not None:
            raise PolarError("Buffered metering has already started")
        self._worker_task_group = await self._stack.enter_async_context(
            anyio.create_task_group()
        )
        self._flush_cancel_scope = await self._worker_task_group.start(self._flush_task)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: types.TracebackType | None,
    ) -> bool | None:
        assert self._flush_cancel_scope is not None
        self._worker_task_group.cancel_scope.shield = True
        self._flush_cancel_scope.deadline = anyio.current_time() + self.shutdown_timeout
        self._send_queue.close()
        await self._stack.aclose()

    async def track(
        self,
        event: EventInput,
    ) -> None:
        """Queue an event without waiting for HTTP delivery.

        Args:
            event: Event including its customer identity.
        """
        await self._send_queue.send(event)

    async def flush(self) -> None:
        """Wait until earlier events are delivered or reported as dropped."""
        if self._flush_cancel_scope is None:
            raise PolarError("Buffered metering has not started")
        request = _FlushRequest()
        await self._send_queue.send(request)
        await request.completed.wait()
        if request.error is not None:
            raise request.error

    async def _on_dropped(self, events: list[EventInput], reason: DropReason) -> None:
        log.warning("Dropping %s events: %s", len(events), reason)
        if self.on_dropped is not None:
            await self.on_dropped(events, reason)

    async def _flush_task(
        self, *, task_status: anyio.abc.TaskStatus[anyio.CancelScope]
    ) -> None:
        async with self._receive_queue:
            batch: list[EventInput] = []
            requests: list[_FlushRequest] = []
            failure: BaseException | None = None
            cancel_scope = anyio.CancelScope(shield=True)
            try:
                with cancel_scope:
                    task_status.started(cancel_scope)
                    stream_closed = False
                    while not stream_closed:
                        try:
                            message = await self._receive_queue.receive()
                        except anyio.EndOfStream:
                            break
                        if isinstance(message, _FlushRequest):
                            message.completed.set()
                            continue
                        batch = [message]
                        try:
                            with anyio.move_on_after(self.batch_interval):
                                while len(batch) < self.batch_size:
                                    if requests:
                                        message = self._receive_queue.receive_nowait()
                                    else:
                                        message = await self._receive_queue.receive()
                                    if isinstance(message, _FlushRequest):
                                        requests.append(message)
                                    else:
                                        batch.append(message)
                        except anyio.WouldBlock:
                            pass
                        except anyio.EndOfStream:
                            stream_closed = True

                        await self._process_batch(batch)
                        batch = []
                        for request in requests:
                            request.completed.set()
                        requests = []
                if cancel_scope.cancelled_caught:
                    failure = TimeoutError("Buffered metering shutdown timed out")
            except BaseException as error:
                failure = error
                raise
            finally:
                self._send_queue.close()
                while True:
                    try:
                        message = self._receive_queue.receive_nowait()
                    except anyio.EndOfStream:
                        break
                    if isinstance(message, _FlushRequest):
                        requests.append(message)
                    else:
                        batch.append(message)
                for request in requests:
                    request.error = failure
                    request.completed.set()
                if cancel_scope.cancelled_caught and batch:
                    await self._on_dropped(batch, "shutdown_timeout")

    async def _process_batch(self, batch: list[EventInput]) -> None:
        attempt = 1
        waited = 0.0
        while True:
            try:
                await self.polar.events.ingest(events=batch)
                break
            except (PolarNetworkError, PolarRateLimitError, PolarServerError) as e:
                if isinstance(e, PolarRateLimitError) and e.retry_after is not None:
                    delay = max(float(e.retry_after), 1.0)
                    waited += delay
                    if waited > RETRY_AFTER_BUDGET:
                        await self._on_dropped(batch, "retry_exhausted")
                        return
                else:
                    if attempt >= self.max_attempts:
                        await self._on_dropped(batch, "retry_exhausted")
                        return
                    delay = _jittered_delay(2**attempt)
                    attempt += 1
                await anyio.sleep(delay)
            except PolarError:
                await self._on_dropped(batch, "permanent_error")
                return
        if self.on_delivered is not None:
            await self.on_delivered(batch)
