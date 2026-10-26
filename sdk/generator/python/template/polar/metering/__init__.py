import contextlib
import datetime
import os
import types
import typing

from polar import PolarError
from polar.base import AsyncClientBase, parse_response_json
from polar.logging import get_logger
from polar.metering.buffered import (
    BufferedMeteringOptions,
    BufferedMeteringStrategy,
    DropReason,
)
from polar.metering.client import PolarClient
from polar.metering.events import (
    ContextualEventInput,
    EventCustomerInput,
    EventExternalCustomerInput,
    EventInput,
)
from polar.metering.meter import CustomerMeter, CustomerMeterList, MeterProtocol

if typing.TYPE_CHECKING:
    from polar.outpost import Outpost

log = get_logger(__name__)


class MeteringError(PolarError):
    """Base error for metering configuration and operations."""


class InvalidActorError(MeteringError):
    """Raised when customer or member identifiers are inconsistent."""


class MeteringOutpostOptions(typing.TypedDict, total=False):
    """Configure the optional Outpost strategy.

    Attributes:
        redis_url: Redis connection URL. Defaults to the REDIS_URL environment variable.
        telemetry: Send Outpost metrics and traces to Polar. Defaults to True;
            POLAR_OUTPOST_TELEMETRY=0 disables it regardless of this option.
    """

    redis_url: str
    telemetry: bool


class MeteringStrategyProtocol(
    contextlib.AbstractAsyncContextManager["MeteringStrategyProtocol"], typing.Protocol
):
    """Strategy contract: manage resources with an async context manager.

    Strategies receive events in order. Implement actor(), meter(), or flush()
    to opt into warmup, meter reads, or explicit draining respectively.
    """

    async def track(self, event: EventInput) -> None:
        """Accept an event for this strategy.

        Args:
            event: Event including its customer identity.
        """
        ...


@typing.runtime_checkable
class ValidateProtocol(typing.Protocol):
    """Optional strategy capability for rejecting an event before any strategy accepts it."""

    def validate(self, event: EventInput) -> None:
        """Raise when the strategy cannot accept the event."""
        ...


@typing.runtime_checkable
class FlushProtocol(typing.Protocol):
    """Optional strategy capability for explicit draining."""

    async def flush(self) -> None:
        """Wait until earlier events are delivered or reported as dropped."""
        ...


@typing.runtime_checkable
class ActorWarmupProtocol(typing.Protocol):
    """Optional strategy capability for preparing a customer before use."""

    async def actor(
        self,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> None:
        """Warm customer state using exactly one customer identifier.

        Args:
            customer_id: Polar customer ID.
            external_customer_id: Customer ID in your application.
        """
        ...


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
    """Dispatch events, actor warmup, and meter reads to metering strategies.

    Create with polar.metering() and use as an async context manager. By
    default, events are buffered for HTTP delivery, with Outpost added when
    outpost is set. Accepting an event does not confirm delivery.
    """

    def __init__(
        self,
        strategies: list[MeteringStrategyProtocol],
        *,
        client: AsyncClientBase,
    ) -> None:
        """Create a helper with explicit strategies.

        Args:
            strategies: Strategies to enter and invoke in order.
            client: Authenticated HTTP client.
        """
        self.strategies = strategies
        self._client = client
        self._running: list[MeteringStrategyProtocol] = []

    async def __aenter__(self) -> typing.Self:
        try:
            for strategy in self.strategies:
                await strategy.__aenter__()
                self._running.append(strategy)
        except BaseException:
            await self._close()
            raise
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: types.TracebackType | None,
    ) -> bool | None:
        await self._close()

    async def _close(self) -> None:
        # In start order: a strategy drains into the ones after it, the buffer into Outpost.
        errors: list[Exception] = []
        for strategy in self._running:
            try:
                await strategy.__aexit__(None, None, None)
            except Exception as error:  # noqa: BLE001
                errors.append(error)
        self._running = []
        if len(errors) == 1:
            raise errors[0]
        if errors:
            raise ExceptionGroup("Metering close failed", errors)

    async def flush(self) -> None:
        """Flush every capable strategy without closing the helper.

        Call this explicitly in serverless environments before returning the
        response so pending events are processed while the request is active.
        Earlier buffered events are delivered or reported to on_dropped before
        returning. Later events are outside this flush. A successful flush does
        not guarantee delivery or immediate visibility in Polar's meter reads.

        Raises:
            ExceptionGroup: One or more strategy flushes failed.
        """
        errors: list[Exception] = []
        for strategy in self.strategies:
            if isinstance(strategy, FlushProtocol):
                try:
                    await strategy.flush()
                except Exception as error:  # noqa: BLE001
                    errors.append(error)
        if errors:
            raise ExceptionGroup("Metering flush failed", errors)

    @typing.overload
    async def track(self, **event: typing.Unpack[EventCustomerInput]) -> None: ...

    @typing.overload
    async def track(
        self, **event: typing.Unpack[EventExternalCustomerInput]
    ) -> None: ...

    async def track(self, **event: typing.Any) -> None:
        """Track an event. It'll be dispatched to all configured strategies.

        Args:
            **event: Event fields with exactly one customer_id or
                external_customer_id. Member IDs must match the identifier kind.
                An event without a timestamp is dated now, once, before any
                strategy sees it.

        Raises:
            InvalidActorError: Customer or member identifiers are inconsistent.
        """
        _validate_actor(
            event.get("customer_id"),
            event.get("member_id"),
            event.get("external_customer_id"),
            event.get("external_member_id"),
        )
        event.setdefault("timestamp", datetime.datetime.now(datetime.UTC).isoformat())
        actor_event = typing.cast(EventInput, event)
        for strategy in self.strategies:
            if isinstance(strategy, ValidateProtocol):
                strategy.validate(actor_event)
        for strategy in self.strategies:
            await strategy.track(actor_event)

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

        For strategies that support it, it warms up their state in memory.

        Args:
            customer_id: Polar customer ID; mutually exclusive with external_customer_id.
            member_id: Polar member ID, paired with customer_id.
            external_customer_id: Customer ID in your application.
            external_member_id: Member ID paired with external_customer_id.

        Returns:
            A helper that attaches this identity to events and reads customer meters.

        Raises:
            InvalidActorError: Customer or member identifiers are inconsistent.
        """
        _validate_actor(
            customer_id, member_id, external_customer_id, external_member_id
        )
        for strategy in self.strategies:
            if isinstance(strategy, ActorWarmupProtocol):
                await strategy.actor(
                    customer_id=customer_id, external_customer_id=external_customer_id
                )
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
            InvalidActorError: Exactly one customer identifier was not provided.
        """
        _validate_actor(customer_id, None, external_customer_id, None)
        for strategy in self.strategies:
            if isinstance(strategy, MeterProtocol):
                return await strategy.meter(
                    meter_id=meter_id,
                    customer_id=customer_id,
                    external_customer_id=external_customer_id,
                )
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
        buffered: BufferedMeteringOptions | None = None,
        outpost: MeteringOutpostOptions | bool | None = None,
        strategies: list[MeteringStrategyProtocol] | None = None,
    ) -> typing.Self:
        """Create an unstarted helper, usually via polar.metering().

        Args:
            polar: Async Polar client used for event delivery and meter reads.
            buffered: Buffer options; omitted fields use BufferedMeteringOptions defaults.
            outpost: True or Outpost options to enable Outpost, which then requires
                redis_url or REDIS_URL. Disabled by default.
            strategies: Replace all default strategies. Cannot be combined with
                buffered or outpost options.

        Returns:
            A helper to enter with async with before use.

        Raises:
            MeteringError: Options conflict or Outpost has no Redis URL.
        """
        if strategies is not None:
            if buffered is not None or outpost is not None:
                raise MeteringError(
                    "Cannot combine strategies with buffered or outpost options"
                )
            return cls(strategies=strategies, client=polar._client)
        buffered = buffered or BufferedMeteringOptions()
        strategies = []
        if outpost is not None and outpost is not False:
            outpost_options = MeteringOutpostOptions() if outpost is True else outpost
            redis_url = outpost_options.get("redis_url", os.environ.get("REDIS_URL"))
            if not redis_url:
                raise MeteringError("Outpost requires redis_url or REDIS_URL")
            from polar.outpost import Outpost

            outpost_strategy = Outpost.create(
                polar, redis_url, telemetry=outpost_options.get("telemetry", True)
            )
            strategies.append(outpost_strategy)
            buffered = _confirming(buffered, outpost_strategy)
        return cls(
            strategies=[BufferedMeteringStrategy(polar, **buffered), *strategies],
            client=polar._client,
        )


def _confirming(
    buffered: BufferedMeteringOptions, outpost: "Outpost"
) -> BufferedMeteringOptions:
    """Settle in Outpost the events the buffer delivered or dropped, before the user's
    callbacks. Polar received the delivered events: they settle where their bucket is hot.
    It will never count the dropped ones: they settle everywhere."""
    user_delivered = buffered.get("on_delivered")
    user_dropped = buffered.get("on_dropped")

    async def settle(events: list[EventInput], *, dropped: bool) -> None:
        try:
            if dropped:
                await outpost.confirm(events)
            else:
                await outpost.acknowledge(events)
        except Exception:
            log.warning(
                "Could not settle %s events in Outpost", len(events), exc_info=True
            )

    async def on_delivered(events: list[EventInput]) -> None:
        await settle(events, dropped=False)
        if user_delivered is not None:
            await user_delivered(events)

    async def on_dropped(events: list[EventInput], reason: DropReason) -> None:
        await settle(events, dropped=True)
        if user_dropped is not None:
            await user_dropped(events, reason)

    return {**buffered, "on_delivered": on_delivered, "on_dropped": on_dropped}


def _validate_actor(
    customer_id: str | None,
    member_id: str | None,
    external_customer_id: str | None,
    external_member_id: str | None,
) -> None:
    if (customer_id is None) == (external_customer_id is None):
        raise InvalidActorError(
            "Provide exactly one customer_id or external_customer_id"
        )
    if member_id is not None and customer_id is None:
        raise InvalidActorError("member_id requires customer_id")
    if external_member_id is not None and external_customer_id is None:
        raise InvalidActorError("external_member_id requires external_customer_id")


__all__ = [
    "ActorMetering",
    "BufferedMeteringOptions",
    "ContextualEventInput",
    "CustomerMeter",
    "DropReason",
    "EventInput",
    "InvalidActorError",
    "Metering",
    "MeteringError",
    "MeteringOutpostOptions",
    "MeteringStrategyProtocol",
]
