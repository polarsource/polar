import contextlib
import datetime
import os
import types
import typing
import uuid

import anyio
import httpx2

from polar.base import AsyncClientBase, parse_response_json
from polar.logging import get_logger
from polar.metering.errors import (
    DeliveryFailure,
    DropReason,
    IngestRejectedError,
    IngestRetryableError,
    MeteringDeliveryError,
    MeteringError,
    MeteringTimeoutError,
    UnknownMeterError,
    retry_after_response,
    validate_timeout,
)
from polar.metering.events import (
    ContextualEventInput,
    EventCustomerInput,
    EventExternalCustomerInput,
    EventInput,
)
from polar.metering.meter import CustomerMeter, CustomerMeterList
from polar.metering.queue import EventQueue, Ingest, OnAck, OnRejected
from polar.metering.queue.memory import MemoryEventQueue

if typing.TYPE_CHECKING:
    from redis.asyncio import Redis

    from polar.outpost.client import Outpost

log = get_logger(__name__)


class PolarClient(typing.Protocol):
    @property
    def _client(self) -> AsyncClientBase: ...


class MeteringOutpostOptions(typing.TypedDict, total=False):
    """Configure optional local reduction.

    Attributes:
        redis: Redis URL or caller-owned asynchronous Redis client. Defaults to REDIS_URL.
        telemetry: Send Outpost metrics and traces to Polar. Defaults to True;
            POLAR_OUTPOST_TELEMETRY=0 disables it regardless of this option.
        snapshot_timeout: Seconds a read of a cold customer waits for its first
            snapshot. Defaults to 5.
    """

    redis: "str | Redis"
    telemetry: bool
    snapshot_timeout: float


class ActorMetering:
    """Customer-bound helper returned by Metering.actor().

    Member identifiers apply to events; meter reads remain customer-wide.
    The helper shares its parent's lifecycle and owns no resources.
    """

    def __init__(
        self,
        metering: "Metering",
        *,
        customer_id: str | None = None,
        member_id: str | None = None,
        external_customer_id: str | None = None,
        external_member_id: str | None = None,
    ) -> None:
        """Bind an metering helper to a validated actor identity.

        Args:
            metering: Parent helper that dispatches operations.
            customer_id: Polar customer ID; mutually exclusive with external_customer_id.
            member_id: Polar member ID, paired with customer_id.
            external_customer_id: Customer ID in your application.
            external_member_id: Member ID paired with external_customer_id.
        """
        self.metering = metering
        self.customer_id = customer_id
        self.member_id = member_id
        self.external_customer_id = external_customer_id
        self.external_member_id = external_member_id

    async def track(self, **event: typing.Unpack[ContextualEventInput]) -> None:
        """Track an event with this actor's identifiers attached.

        Args:
            **event: Event name and optional metadata, timestamp, or external ID.
        """
        if self.customer_id is not None:
            await self.metering.track(
                customer_id=self.customer_id, member_id=self.member_id, **event
            )
        else:
            assert self.external_customer_id is not None
            await self.metering.track(
                external_customer_id=self.external_customer_id,
                external_member_id=self.external_member_id,
                **event,
            )

    async def meter(self, meter_id: str) -> CustomerMeter | None:
        """Read this customer's meter using the parent's read strategy.

        Args:
            meter_id: Polar meter ID.

        Returns:
            Consumption, credits, and balance, or None if no meter is found.
        """
        if self.customer_id is not None:
            return await self.metering.meter(
                meter_id=meter_id, customer_id=self.customer_id
            )
        assert self.external_customer_id is not None
        return await self.metering.meter(
            meter_id=meter_id, external_customer_id=self.external_customer_id
        )


class Metering:
    """Deliver events through a queue and optionally reduce them locally."""

    def __init__(
        self,
        queue: EventQueue,
        *,
        client: AsyncClientBase,
        outpost: "Outpost | None" = None,
        on_ack: OnAck | None = None,
        on_rejected: OnRejected | None = None,
    ) -> None:
        self.queue = queue
        self._active_queue = queue
        self.outpost = outpost
        self._client = client
        self._caller_on_ack = on_ack
        self._caller_on_rejected = on_rejected
        self._stack = contextlib.AsyncExitStack()

    async def __aenter__(self) -> typing.Self:
        on_ack = (
            self._on_ack
            if self._caller_on_ack is not None or self.outpost is not None
            else None
        )
        on_rejected = (
            self._on_rejected
            if self._caller_on_rejected is not None or self.outpost is not None
            else None
        )
        try:
            if self.outpost is None:
                session = self.queue.open(
                    ingest=self._ingest, on_ack=on_ack, on_rejected=on_rejected
                )
            else:
                outpost = await self._stack.enter_async_context(self.outpost)
                from polar.metering.queue.redis import RedisEventQueue

                queue = self.queue
                if (
                    type(queue) is RedisEventQueue
                    and queue.redis_url is not None
                    and queue.redis_url == outpost.redis_url
                ):
                    session = queue._open(
                        outpost._require_redis(),
                        ingest=self._ingest,
                        on_ack=on_ack,
                        on_rejected=on_rejected,
                    )
                else:
                    session = queue.open(
                        ingest=self._ingest,
                        on_ack=on_ack,
                        on_rejected=on_rejected,
                    )
            self._active_queue = await self._stack.enter_async_context(session)
        except BaseException:
            await self._stack.aclose()
            raise
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: types.TracebackType | None,
    ) -> bool | None:
        try:
            return await self._stack.__aexit__(exc_type, exc_value, traceback)
        finally:
            self._active_queue = self.queue

    async def flush(self, *, timeout: float = 30.0) -> None:
        """Wait for earlier events to be delivered."""
        validate_timeout(timeout)
        deadline = anyio.current_time() + timeout
        try:
            with anyio.fail_after(timeout):
                await self._active_queue.flush(timeout=timeout)
                if self.outpost is not None:
                    await self.outpost.flush(
                        timeout=max(0.0, deadline - anyio.current_time())
                    )
        except MeteringTimeoutError:
            raise
        except TimeoutError as error:
            raise MeteringTimeoutError(timeout) from error

    @typing.overload
    async def track(self, **event: typing.Unpack[EventCustomerInput]) -> None: ...

    @typing.overload
    async def track(
        self, **event: typing.Unpack[EventExternalCustomerInput]
    ) -> None: ...

    async def track(self, **event: typing.Any) -> None:
        """Enqueue an event and apply it to Outpost when enabled.

        Args:
            **event: Event fields with exactly one customer_id or
                external_customer_id. Member IDs must match the identifier kind.
                An event without a timestamp is dated now, once, before any
                queue sees it.

        Raises:
            ValueError: Customer or member identifiers are inconsistent.
        """
        _validate_actor(
            event.get("customer_id"),
            event.get("member_id"),
            event.get("external_customer_id"),
            event.get("external_member_id"),
        )
        event.setdefault("timestamp", datetime.datetime.now(datetime.UTC).isoformat())
        if not event.get("external_id"):
            event["external_id"] = str(uuid.uuid4())
        actor_event = typing.cast(EventInput, event)
        await self._active_queue.enqueue(actor_event)
        if self.outpost is not None:
            try:
                await self.outpost.track(actor_event)
            except Exception as error:  # noqa: BLE001
                log.warning(
                    "Outpost failed to reduce an enqueued event (%s)",
                    type(error).__name__,
                )

    @typing.overload
    async def actor(
        self, *, customer_id: str, member_id: str | None = None
    ) -> ActorMetering: ...

    @typing.overload
    async def actor(
        self, *, external_customer_id: str, external_member_id: str | None = None
    ) -> ActorMetering: ...

    async def actor(
        self,
        *,
        customer_id: str | None = None,
        member_id: str | None = None,
        external_customer_id: str | None = None,
        external_member_id: str | None = None,
    ) -> ActorMetering:
        """Create customer-bound helper.

        When enabled, Outpost warms up the customer state.

        Args:
            customer_id: Polar customer ID; mutually exclusive with external_customer_id.
            member_id: Polar member ID, paired with customer_id.
            external_customer_id: Customer ID in your application.
            external_member_id: Member ID paired with external_customer_id.

        Returns:
            A helper that attaches this identity to events and reads customer meters.

        Raises:
            ValueError: Customer or member identifiers are inconsistent.
        """
        _validate_actor(
            customer_id, member_id, external_customer_id, external_member_id
        )
        if self.outpost is not None:
            from polar.outpost.errors import PolarOutpostError

            try:
                await self.outpost.actor(
                    customer_id=customer_id, external_customer_id=external_customer_id
                )
            except PolarOutpostError:
                pass
        return ActorMetering(
            self,
            customer_id=customer_id,
            member_id=member_id,
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
        )

    @typing.overload
    async def meter(
        self, meter_id: str, *, customer_id: str
    ) -> CustomerMeter | None: ...

    @typing.overload
    async def meter(
        self, meter_id: str, *, external_customer_id: str
    ) -> CustomerMeter | None: ...

    async def meter(
        self,
        meter_id: str,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> CustomerMeter | None:
        """Read a meter value.

        If enabled, the local value from Outpost will be read. Otherwise, it'll
        fall back to the Polar API.

        Args:
            meter_id: Polar meter ID.
            customer_id: Polar customer ID; mutually exclusive with external_customer_id.
            external_customer_id: Customer ID in your application.

        Returns:
            Consumption, credits, and balance, or None if no meter is found.

        Raises:
            ValueError: Exactly one customer identifier was not provided.
        """
        _validate_actor(customer_id, None, external_customer_id, None)
        if self.outpost is not None:
            from polar.outpost.errors import PolarOutpostError

            try:
                return await self.outpost.meter(
                    meter_id=meter_id,
                    customer_id=customer_id,
                    external_customer_id=external_customer_id,
                )
            except (UnknownMeterError, PolarOutpostError):
                pass
        request = self._client.build_request(
            method="GET",
            url="/v1/customer-meters/",
            query_params={
                "meter_id": meter_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "limit": 1,
            },
        )
        response = await self._client.send_request(request)
        result: CustomerMeterList = parse_response_json(response, CustomerMeterList)
        return result.items[0] if result.items else None

    @classmethod
    def create(
        cls,
        polar: PolarClient,
        *,
        queue: EventQueue | None = None,
        outpost: MeteringOutpostOptions | bool | None = None,
        on_ack: OnAck | None = None,
        on_rejected: OnRejected | None = None,
    ) -> typing.Self:
        if queue is None:
            queue = MemoryEventQueue()
        if outpost is None or outpost is False:
            return cls(
                queue, client=polar._client, on_ack=on_ack, on_rejected=on_rejected
            )

        options = MeteringOutpostOptions() if outpost is True else outpost
        redis_source = options.get("redis", os.environ.get("REDIS_URL"))
        if redis_source is None or redis_source == "":
            raise MeteringError("Outpost requires redis or REDIS_URL")
        from polar.outpost.client import SNAPSHOT_TIMEOUT, Outpost

        return cls(
            queue,
            client=polar._client,
            on_ack=on_ack,
            on_rejected=on_rejected,
            outpost=Outpost.create(
                polar,
                redis=redis_source,
                telemetry=options.get("telemetry", True),
                snapshot_timeout=options.get("snapshot_timeout", SNAPSHOT_TIMEOUT),
            ),
        )

    async def _ingest(self, events: list[EventInput]) -> None:
        await _ingest_events(self._client._client, events)

    async def _on_ack(self, events: list[EventInput]) -> None:
        if self.outpost is not None:
            await self.outpost.on_ack(events)
        if self._caller_on_ack is not None:
            try:
                await self._caller_on_ack(events)
            except Exception as error:  # noqa: BLE001
                log.warning(
                    "Metering acknowledgement hook failed (%s)", type(error).__name__
                )

    async def _on_rejected(self, events: list[EventInput], reason: DropReason) -> None:
        if self.outpost is not None:
            await self.outpost.on_rejected(events, reason)
        if self._caller_on_rejected is not None:
            try:
                await self._caller_on_rejected(events, reason)
            except Exception as error:  # noqa: BLE001
                log.warning("Metering rejection hook failed (%s)", type(error).__name__)


async def _ingest_events(client: httpx2.AsyncClient, events: list[EventInput]) -> None:
    try:
        response = await client.post("/v1/events/ingest", json={"events": events})
    except httpx2.RequestError as error:
        raise IngestRetryableError() from error

    try:
        response.raise_for_status()
    except httpx2.HTTPStatusError as error:
        if response.is_client_error and response.status_code not in (
            401,
            403,
            408,
            429,
        ):
            raise IngestRejectedError(
                rejected_indexes=_refused_indexes(response, len(events))
            ) from error
        raise IngestRetryableError(
            retry_after=retry_after_response(response)
        ) from error


def _refused_indexes(response: httpx2.Response, batch_size: int) -> set[int] | None:
    """The indexes of the events Polar's validation refuses, when each of its errors
    names one."""
    if response.status_code != 422:
        return None
    try:
        locations = [error["loc"] for error in response.json()["detail"]]
    except (ValueError, KeyError, TypeError):
        return None
    indexes: set[int] = set()
    for location in locations:
        if (
            not isinstance(location, list)
            or len(location) < 3
            or location[:2] != ["body", "events"]
            or type(location[2]) is not int
            or not 0 <= location[2] < batch_size
        ):
            return None
        indexes.add(location[2])
    return indexes or None


def _validate_actor(
    customer_id: str | None,
    member_id: str | None,
    external_customer_id: str | None,
    external_member_id: str | None,
) -> None:
    if (customer_id is None) == (external_customer_id is None):
        raise ValueError("Provide exactly one customer_id or external_customer_id")
    if member_id is not None and customer_id is None:
        raise ValueError("member_id requires customer_id")
    if external_member_id is not None and external_customer_id is None:
        raise ValueError("external_member_id requires external_customer_id")


__all__ = [
    "ActorMetering",
    "ContextualEventInput",
    "CustomerMeter",
    "DeliveryFailure",
    "DropReason",
    "EventInput",
    "EventQueue",
    "Ingest",
    "IngestRejectedError",
    "IngestRetryableError",
    "Metering",
    "MeteringDeliveryError",
    "MeteringError",
    "MeteringOutpostOptions",
    "MeteringTimeoutError",
    "UnknownMeterError",
]
