import contextlib
import dataclasses
import math
import random
import types
import typing

import anyio
import anyio.lowlevel

from polar import PolarError, PolarNetworkError, PolarRateLimitError, PolarServerError
from polar.logging import get_logger
from polar.metering.client import MeteringClient
from polar.metering.errors import (
    DeliveryFailure,
    DropReason,
    MeteringDeliveryError,
    MeteringTimeoutError,
    validate_timeout,
)
from polar.metering.events import EventInput

log = get_logger(__name__)


def _jittered_delay(base: float, jitter: float = 0.1) -> float:
    return base * (1 + random.uniform(-jitter, jitter))


RETRY_AFTER_BUDGET = 300.0


class BufferedMeteringOptions(typing.TypedDict, total=False):
    """Configure in-memory batching and delivery to Polar.

    Attributes:
        batch_size: Maximum events per request. Defaults to 100.
        batch_interval: Seconds to collect a batch after its first event. Defaults to 1.
        shutdown_timeout: Seconds allowed to drain on exit. Defaults to 30.
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
class _QueuedEvent:
    sequence: int
    event: EventInput


@dataclasses.dataclass
class _FailedEvent:
    sequence: int
    failure: DeliveryFailure


@dataclasses.dataclass(eq=False)
class _FlushRequest:
    after: int
    through: int
    active: bool = True
    completed: anyio.Event = dataclasses.field(default_factory=anyio.Event)
    error: BaseException | None = None


class BufferedMeteringStrategy:
    """Batch events in memory and deliver them through Polar's HTTP API."""

    def __init__(
        self,
        polar: MeteringClient,
        batch_size: int = 100,
        batch_interval: float = 1.0,
        shutdown_timeout: float = 30.0,
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
            shutdown_timeout: Drain deadline in seconds. Defaults to 30.
            max_attempts: Total attempts per batch. Defaults to 3.
            on_delivered: Awaited callback for events Polar accepted.
            on_dropped: Awaited callback for dropped events and the drop reason.

        Raises:
            ValueError: batch_size is not positive or shutdown_timeout is invalid.
        """
        if batch_size <= 0:
            raise ValueError("batch_size must be greater than zero")
        validate_timeout(shutdown_timeout)
        self.polar = polar
        self.batch_size = batch_size
        self.batch_interval = batch_interval
        self.shutdown_timeout = shutdown_timeout
        self.max_attempts = max_attempts
        self.on_delivered = on_delivered
        self.on_dropped = on_dropped
        self._send_queue, self._receive_queue = anyio.create_memory_object_stream[
            _QueuedEvent | _FlushRequest
        ](math.inf)
        self._stack = contextlib.AsyncExitStack()
        self._flush_cancel_scope: anyio.CancelScope | None = None
        self._sequence = 0
        self._acknowledged = 0
        self._barriers: set[_FlushRequest] = set()
        self._failures: list[_FailedEvent] = []
        self._pending: dict[int, EventInput] = {}
        self._failure: BaseException | None = None
        self._finished = False
        self._closed = False

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
        """Drain accepted events within shutdown_timeout and report failures."""
        assert self._flush_cancel_scope is not None
        request = self._barrier()
        self._closed = True
        self._worker_task_group.cancel_scope.shield = True
        self._flush_cancel_scope.deadline = anyio.current_time() + self.shutdown_timeout
        self._send_queue.close()
        try:
            await self._stack.aclose()
            self._finish(request)
            self._acknowledged = max(self._acknowledged, request.through)
            if request.error is not None:
                if exc_value is not None:
                    raise BaseExceptionGroup(
                        "Metering body and delivery failed", [exc_value, request.error]
                    )
                raise request.error
        finally:
            self._release(request)

    async def track(
        self,
        event: EventInput,
    ) -> None:
        """Queue an event without waiting for HTTP delivery.

        Args:
            event: Event including its customer identity.
        """
        await anyio.lowlevel.checkpoint()
        if self._failure is not None:
            raise self._failure
        if self._flush_cancel_scope is None:
            raise PolarError("Buffered metering has not started")
        self._sequence += 1
        self._send_queue.send_nowait(_QueuedEvent(self._sequence, event))
        self._pending[self._sequence] = event

    async def flush(self, *, timeout: float = 30.0) -> None:
        """Confirm earlier events or raise their unacknowledged delivery failures.

        Overlapping callers each observe failures within their queue boundary.
        A timeout or caller cancellation leaves outcomes observable by a later
        flush and does not cancel background delivery or other callers.

        Args:
            timeout: Maximum wait in seconds. Defaults to 30.

        Raises:
            MeteringDeliveryError: Earlier events could not be confirmed.
            MeteringTimeoutError: The caller's wait expired.
        """
        validate_timeout(timeout)
        if self._flush_cancel_scope is None:
            raise PolarError("Buffered metering has not started")
        if self._closed:
            raise anyio.ClosedResourceError
        request = self._barrier()
        try:
            if self._finished:
                self._finish(request)
            else:
                self._send_queue.send_nowait(request)
            with anyio.move_on_after(timeout) as scope:
                await request.completed.wait()
                await anyio.lowlevel.checkpoint_if_cancelled()
            if scope.cancelled_caught:
                raise MeteringTimeoutError(timeout)
            self._acknowledged = max(self._acknowledged, request.through)
            if request.error is not None:
                raise request.error
        finally:
            self._release(request)

    def _barrier(self) -> _FlushRequest:
        request = _FlushRequest(self._acknowledged, self._sequence)
        self._barriers.add(request)
        return request

    def _finish(self, request: _FlushRequest) -> None:
        if not request.active or request.completed.is_set():
            return
        failures = [
            item.failure
            for item in self._failures
            if request.after < item.sequence <= request.through
        ]
        request.error = MeteringDeliveryError(failures) if failures else self._failure
        request.completed.set()

    def _release(self, request: _FlushRequest) -> None:
        request.active = False
        self._barriers.discard(request)
        oldest = min(
            (item.after for item in self._barriers), default=self._acknowledged
        )
        self._failures = [item for item in self._failures if item.sequence > oldest]

    async def _on_dropped(self, events: list[EventInput], reason: DropReason) -> None:
        log.warning("Dropping %s events: %s", len(events), reason)
        if self.on_dropped is not None:
            await self.on_dropped(events, reason)

    async def _flush_task(
        self, *, task_status: anyio.abc.TaskStatus[anyio.CancelScope]
    ) -> None:
        async with self._receive_queue:
            batch: list[_QueuedEvent] = []
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
                            self._finish(message)
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

                        events = [item.event for item in batch]
                        outcome = await self._process_batch(events)
                        for item in batch:
                            self._pending.pop(item.sequence)
                            if outcome is not None:
                                self._failures.append(
                                    _FailedEvent(
                                        item.sequence,
                                        DeliveryFailure(
                                            [item.event], outcome.reason, outcome.cause
                                        ),
                                    )
                                )
                        batch = []
                        if outcome is not None:
                            await self._on_dropped(events, outcome.reason)
                        elif self.on_delivered is not None:
                            await self.on_delivered(events)
                        for request in requests:
                            self._finish(request)
                        requests = []
                if cancel_scope.cancelled_caught:
                    failure = TimeoutError("Buffered metering shutdown timed out")
                    if not self._pending:
                        self._failure = MeteringTimeoutError(self.shutdown_timeout)
            except BaseException as error:  # noqa: BLE001
                failure = error
                self._failure = error
            finally:
                self._send_queue.close()
                while True:
                    try:
                        message = self._receive_queue.receive_nowait()
                    except (anyio.EndOfStream, anyio.WouldBlock):
                        break
                    if isinstance(message, _FlushRequest):
                        requests.append(message)
                if failure is not None:
                    reason: DropReason = (
                        "shutdown_timeout"
                        if cancel_scope.cancelled_caught
                        else "worker_error"
                    )
                    pending = list(self._pending.values())
                    for sequence, event in self._pending.items():
                        self._failures.append(
                            _FailedEvent(
                                sequence, DeliveryFailure([event], reason, failure)
                            )
                        )
                    self._pending.clear()
                    try:
                        cleanup_scope = anyio.CancelScope(
                            deadline=cancel_scope.deadline, shield=True
                        )
                        self._flush_cancel_scope = cleanup_scope
                        with cleanup_scope:
                            if pending:
                                await self._on_dropped(pending, reason)
                    except BaseException as callback_error:  # noqa: BLE001
                        self._failure = BaseExceptionGroup(
                            "Metering worker and drop callback failed",
                            [failure, callback_error],
                        )
                self._finished = True
                for request in requests:
                    self._finish(request)

    async def _process_batch(self, batch: list[EventInput]) -> DeliveryFailure | None:
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
                        return DeliveryFailure(batch, "retry_exhausted", e)
                else:
                    if attempt >= self.max_attempts:
                        return DeliveryFailure(batch, "retry_exhausted", e)
                    delay = _jittered_delay(2**attempt)
                    attempt += 1
                await anyio.sleep(delay)
            except PolarError as error:
                return DeliveryFailure(batch, "permanent_error", error)
        return None
