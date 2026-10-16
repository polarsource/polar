import contextlib
import types
import typing

from polar import PolarError
from polar.ingestion.buffered import (
    BufferedIngestionStrategy as BufferedIngestionStrategy,
)
from polar.ingestion.client import IngestionClient, PolarClient
from polar.ingestion.events import (
    ContextualEventInput,
    EventCustomerInput,
    EventExternalCustomerInput,
    EventInput,
)
from polar.logging import get_logger

log = get_logger(__name__)


class IngestionError(PolarError): ...


class InvalidActorError(IngestionError): ...


class IngestionStrategyProtocol(
    contextlib.AbstractAsyncContextManager["IngestionStrategyProtocol"], typing.Protocol
):
    async def ingest(self, event: EventInput) -> None: ...


@typing.runtime_checkable
class ActorWarmupProtocol(typing.Protocol):
    async def actor(
        self,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> None: ...


class ActorIngestion:
    def __init__(
        self,
        ingestion: "Ingestion",
        *,
        customer_id: str | None = None,
        member_id: str | None = None,
        external_customer_id: str | None = None,
        external_member_id: str | None = None,
    ) -> None:
        self.ingestion = ingestion
        self.customer_id = customer_id
        self.member_id = member_id
        self.external_customer_id = external_customer_id
        self.external_member_id = external_member_id

    async def ingest(self, **event: typing.Unpack[ContextualEventInput]) -> None:
        if self.customer_id is not None:
            await self.ingestion.ingest(
                customer_id=self.customer_id, member_id=self.member_id, **event
            )
        else:
            assert self.external_customer_id is not None
            await self.ingestion.ingest(
                external_customer_id=self.external_customer_id,
                external_member_id=self.external_member_id,
                **event,
            )


class Ingestion:
    def __init__(self, strategies: list[IngestionStrategyProtocol]) -> None:
        self.strategies = strategies
        self._stack = contextlib.AsyncExitStack()

    async def __aenter__(self) -> typing.Self:
        try:
            for strategy in self.strategies:
                await self._stack.enter_async_context(strategy)
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
        await self._stack.aclose()

    @typing.overload
    async def ingest(self, **event: typing.Unpack[EventCustomerInput]) -> None: ...

    @typing.overload
    async def ingest(
        self, **event: typing.Unpack[EventExternalCustomerInput]
    ) -> None: ...

    async def ingest(self, **event: typing.Any) -> None:
        _validate_actor(
            event.get("customer_id"),
            event.get("member_id"),
            event.get("external_customer_id"),
            event.get("external_member_id"),
        )
        actor_event = typing.cast(EventInput, event)
        for strategy in self.strategies:
            await strategy.ingest(actor_event)

    @typing.overload
    async def actor(
        self, *, customer_id: str, member_id: str | None = None
    ) -> ActorIngestion: ...

    @typing.overload
    async def actor(
        self, *, external_customer_id: str, external_member_id: str | None = None
    ) -> ActorIngestion: ...

    async def actor(
        self,
        *,
        customer_id: str | None = None,
        member_id: str | None = None,
        external_customer_id: str | None = None,
        external_member_id: str | None = None,
    ) -> ActorIngestion:
        _validate_actor(
            customer_id, member_id, external_customer_id, external_member_id
        )
        for strategy in self.strategies:
            if isinstance(strategy, ActorWarmupProtocol):
                await strategy.actor(
                    customer_id=customer_id, external_customer_id=external_customer_id
                )
        return ActorIngestion(
            self,
            customer_id=customer_id,
            member_id=member_id,
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
        )

    @classmethod
    def create(
        cls, polar: PolarClient, outpost_redis_url: str | None = None
    ) -> typing.Self:
        strategies: list[IngestionStrategyProtocol] = [BufferedIngestionStrategy(polar)]
        if outpost_redis_url is not None:
            from polar.outpost import Outpost

            strategies.append(Outpost.create(polar, outpost_redis_url))
        return cls(strategies=strategies)


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
    "ActorIngestion",
    "ActorWarmupProtocol",
    "ContextualEventInput",
    "EventInput",
    "Ingestion",
    "IngestionClient",
    "IngestionError",
    "InvalidActorError",
    "PolarClient",
]
