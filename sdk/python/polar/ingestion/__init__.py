import contextlib
import os
import types
import typing

from polar import PolarError
from polar.base import AsyncClientBase, parse_response_json
from polar.ingestion.buffered import (
    BufferedIngestionOptions as BufferedIngestionOptions,
)
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
from polar.ingestion.meter import CustomerMeter, CustomerMeterList, MeterProtocol
from polar.logging import get_logger

log = get_logger(__name__)


class IngestionError(PolarError): ...


class InvalidActorError(IngestionError): ...


class IngestionOutpostOptions(typing.TypedDict, total=False):
    redis_url: str
    telemetry: bool


class IngestionStrategyProtocol(
    contextlib.AbstractAsyncContextManager["IngestionStrategyProtocol"], typing.Protocol
):
    async def ingest(self, event: EventInput) -> None: ...


@typing.runtime_checkable
class FlushProtocol(typing.Protocol):
    async def flush(self) -> None: ...


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

    async def meter(self, meter_id: str) -> CustomerMeter | None:
        if self.customer_id is not None:
            return await self.ingestion.meter(
                meter_id=meter_id, customer_id=self.customer_id
            )
        assert self.external_customer_id is not None
        return await self.ingestion.meter(
            meter_id=meter_id, external_customer_id=self.external_customer_id
        )


class Ingestion:
    def __init__(
        self,
        strategies: list[IngestionStrategyProtocol],
        *,
        client: AsyncClientBase,
    ) -> None:
        self.strategies = strategies
        self._client = client
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

    async def flush(self) -> None:
        errors: list[Exception] = []
        for strategy in self.strategies:
            if isinstance(strategy, FlushProtocol):
                try:
                    await strategy.flush()
                except Exception as error:  # noqa: BLE001
                    errors.append(error)
        if errors:
            raise ExceptionGroup("Ingestion flush failed", errors)

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

    @typing.overload
    async def meter(
        self, *, meter_id: str, customer_id: str
    ) -> CustomerMeter | None: ...

    @typing.overload
    async def meter(
        self, *, meter_id: str, external_customer_id: str
    ) -> CustomerMeter | None: ...

    async def meter(
        self,
        *,
        meter_id: str,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> CustomerMeter | None:
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
        buffered: BufferedIngestionOptions | None = None,
        outpost: IngestionOutpostOptions | typing.Literal[False] | None = None,
        strategies: list[IngestionStrategyProtocol] | None = None,
    ) -> typing.Self:
        if strategies is not None:
            if buffered is not None or outpost is not None:
                raise IngestionError(
                    "Cannot combine strategies with buffered or outpost options"
                )
            return cls(strategies=strategies, client=polar._client)
        strategies = [BufferedIngestionStrategy(polar, **(buffered or {}))]
        if outpost is not False:
            outpost_options = (
                outpost if outpost is not None else IngestionOutpostOptions()
            )
            redis_url = outpost_options.get("redis_url", os.environ.get("REDIS_URL"))
            if outpost is not None and not redis_url:
                raise IngestionError("Outpost requires redis_url or REDIS_URL")
            if redis_url:
                from polar.outpost import Outpost

                strategies.append(
                    Outpost.create(
                        polar,
                        redis_url,
                        telemetry=outpost_options.get("telemetry", True),
                    )
                )
        return cls(strategies=strategies, client=polar._client)


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
    "BufferedIngestionOptions",
    "BufferedIngestionStrategy",
    "ContextualEventInput",
    "CustomerMeter",
    "EventInput",
    "FlushProtocol",
    "Ingestion",
    "IngestionClient",
    "IngestionError",
    "IngestionOutpostOptions",
    "IngestionStrategyProtocol",
    "InvalidActorError",
    "MeterProtocol",
    "PolarClient",
]
