import builtins
import collections.abc
import contextlib
import dataclasses
import datetime
import enum
import types
import typing
import uuid

import adaptix
import adaptix.load_error
import anyio
import httpx2
import typing_extensions
from adaptix._internal.morphing.provider_template import LoaderProvider
from adaptix._internal.morphing.request_cls import LoaderRequest
from adaptix._internal.provider.loc_stack_filtering import LocStack, LocStackChecker
from adaptix._internal.provider.location import GenericParamLoc
from adaptix.provider import CannotProvide, Mediator

from polar import _httpx_compat
from polar._errors import PolarError
from polar.actor import Actor, validate_actor
from polar.logging import get_logger
from polar.metering.errors import (
    DropReason,
    MeteringTimeoutError,
    UnknownMeterError,
    validate_timeout,
)
from polar.metering.events import (
    EventCustomerInput,
    EventExternalCustomerInput,
    EventInput,
    ingest_events,
)
from polar.metering.meter import CustomerMeter, CustomerMeterList
from polar.metering.queue import EventQueue, OnAck, OnRejected
from polar.metering.queue.memory import MemoryEventQueue

if typing.TYPE_CHECKING:
    from redis.asyncio import Redis

    from polar.outpost import Outpost

log = get_logger(__name__)

_EnvironmentT = typing.TypeVar("_EnvironmentT", bound=str)
_ModelT = typing.TypeVar("_ModelT")
RequestTimeout: typing.TypeAlias = _httpx_compat.RequestTimeout


class _OpenEnumMarker:
    pass


_OPEN_ENUM = _OpenEnumMarker()


@dataclasses.dataclass(frozen=True)
class _Discriminator:
    field: str
    variants: tuple[tuple[str, typing.Any], ...]


class _DiscriminatedUnionProvider(LoaderProvider):
    def provide_loader(
        self, mediator: Mediator, request: LoaderRequest
    ) -> collections.abc.Callable[[typing.Any], typing.Any]:
        hint = request.last_loc.type
        if typing.get_origin(hint) is not typing.Annotated:
            raise CannotProvide
        discriminator = next(
            (
                item
                for item in typing.get_args(hint)[1:]
                if isinstance(item, _Discriminator)
            ),
            None,
        )
        if discriminator is None:
            raise CannotProvide
        loaders = {
            tag: mediator.mandatory_provide(
                request.with_loc_stack(
                    request.loc_stack.append_with(
                        GenericParamLoc(type=variant, generic_pos=index)
                    )
                )
            )
            for index, (tag, variant) in enumerate(discriminator.variants)
        }
        field = discriminator.field
        nullable = type(None) in typing.get_args(typing.get_args(hint)[0])

        def load(data: object) -> typing.Any:
            if data is None and nullable:
                return None
            if not isinstance(data, collections.abc.Mapping):
                raise adaptix.load_error.TypeLoadError(collections.abc.Mapping, data)
            if field not in data:
                raise adaptix.load_error.NoRequiredFieldsLoadError({field}, data)
            tag = data[field]
            if not isinstance(tag, str) or tag not in loaders:
                raise adaptix.load_error.BadVariantLoadError(tuple(loaders), tag)
            return loaders[tag](data)

        return load


class _ScalarUnionProvider(LoaderProvider):
    def provide_loader(
        self, mediator: Mediator, request: LoaderRequest
    ) -> collections.abc.Callable[[typing.Any], typing.Any]:
        hint = request.last_loc.type
        if typing.get_origin(hint) not in (typing.Union, types.UnionType):
            raise CannotProvide
        scalar_types = frozenset(typing.get_args(hint))
        if not scalar_types <= {str, int, float, bool, type(None)}:
            raise CannotProvide
        fallback = mediator.provide_from_next()

        def load(data: object) -> typing.Any:
            if type(data) in scalar_types:
                return data
            return fallback(data)

        return load


class PolarNetworkError(PolarError):
    def __init__(self, message: str):
        super().__init__(f"Polar API network error: {message}")


class PolarServerError(PolarError):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(
            f"Polar API returned a server error: {status_code} - {message}"
        )


class PolarDeserializationError(PolarError):
    def __init__(self, error: adaptix.load_error.LoadError):
        self.error = error
        super().__init__(f"Failed to deserialize data: {error}")


class PolarClientError(PolarError):
    error_type: typing.ClassVar[typing.Any]
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any):
        self.status_code = status_code
        self.error = error
        super().__init__(f"Polar API returned an error: {status_code} - {error}")


class PolarRateLimitError(PolarClientError):
    error_type = None

    def __init__(
        self, status_code: typing.Literal[429], retry_after: int | None = None
    ):
        super().__init__(status_code, "Rate limit exceeded")
        self.retry_after = retry_after


def resolve_base_url(
    servers: collections.abc.Mapping[_EnvironmentT, str],
    environment: _EnvironmentT,
    base_url: str | None,
) -> str:
    if base_url is not None:
        return base_url
    try:
        return servers[environment]
    except KeyError as e:
        environments = ", ".join(sorted(servers))
        raise ValueError(
            f"Invalid environment {environment!r}. Expected one of: {environments}."
        ) from e


def _default_headers(
    version: str, access_token: str, organization_id: str | None
) -> dict[str, str]:
    headers = {
        "Polar-Version": version,
        "Authorization": f"Bearer {access_token}",
        "User-Agent": "polar-sdk-python/1.3.3",
    }
    if organization_id is not None:
        headers["Polar-Organization"] = organization_id
    return headers


class BuildRequestMixin:
    def build_request(
        self: "SyncClientBase | AsyncClientBase",
        method: str,
        url: str,
        path_params: dict[str, typing.Any] | None = None,
        query_params: dict[str, typing.Any] | None = None,
        body: typing.Any | None = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> httpx2.Request:
        url = url.format(**(path_params or {}))

        params: dict[str, typing.Any] = {}
        for k, v in (query_params or {}).items():
            if v is None:
                continue
            if isinstance(v, dict):
                for sub_k, sub_v in v.items():
                    if sub_v is None:
                        continue
                    params[f"{k}[{sub_k}]"] = sub_v
            else:
                params[k] = v

        timeout = (
            self._client.timeout
            if request_timeout is None
            else _httpx_compat.to_httpx2_timeout(request_timeout)
        )
        headers: dict[str, str] | None = None
        if request_access_token is not None:
            headers = {"Authorization": f"Bearer {request_access_token}"}
        return self._client.build_request(
            method, url, params=params, json=body, timeout=timeout, headers=headers
        )


class SyncClientBase(BuildRequestMixin):
    def __init__(
        self,
        base_url: str,
        version: str,
        access_token: str,
        timeout: RequestTimeout | None = 5.0,
        organization_id: str | None = None,
    ) -> None:
        self._client = httpx2.Client(
            base_url=base_url,
            timeout=_httpx_compat.to_httpx2_timeout(timeout),
            headers=_default_headers(version, access_token, organization_id),
        )

    def __enter__(self) -> typing.Self:
        self._client.__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        self._client.__exit__(exc_type, exc_val, exc_tb)

    def send_request(self, request: httpx2.Request) -> httpx2.Response:
        try:
            return self._client.send(request)
        except httpx2.RequestError as e:
            raise PolarNetworkError(str(e)) from e


class AsyncClientBase(BuildRequestMixin):
    def __init__(
        self,
        base_url: str,
        version: str,
        access_token: str,
        timeout: RequestTimeout | None = 5.0,
        organization_id: str | None = None,
    ) -> None:
        self._client = httpx2.AsyncClient(
            base_url=base_url,
            timeout=_httpx_compat.to_httpx2_timeout(timeout),
            headers=_default_headers(version, access_token, organization_id),
        )

    async def __aenter__(self) -> typing.Self:
        await self._client.__aenter__()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        await self._client.__aexit__(exc_type, exc_val, exc_tb)

    async def send_request(self, request: httpx2.Request) -> httpx2.Response:
        try:
            return await self._client.send(request)
        except httpx2.RequestError as e:
            raise PolarNetworkError(str(e)) from e


class PolarSyncBase:
    """Base for versioned synchronous Polar clients."""

    version: str

    def __init__(
        self,
        base_url: str,
        access_token: str,
        timeout: RequestTimeout | None,
        organization_id: str | None,
    ) -> None:
        self._client = SyncClientBase(
            base_url, self.version, access_token, timeout, organization_id
        )

    def __enter__(self) -> typing.Self:
        self._client.__enter__()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        self._client.__exit__(exc_type, exc_val, exc_tb)


class _DefaultEventQueue(enum.Enum):
    MEMORY = "memory"


class OutpostOptions(typing.TypedDict):
    redis: "str | Redis"
    telemetry: typing.NotRequired[bool]
    snapshot_timeout: typing.NotRequired[float]


class PolarAsyncBase:
    """Base for versioned asynchronous Polar clients."""

    version: str
    outpost: "Outpost | None"

    def __init__(
        self,
        base_url: str,
        access_token: str,
        timeout: RequestTimeout | None,
        organization_id: str | None,
        *,
        event_queue: EventQueue
        | None
        | typing.Literal[_DefaultEventQueue.MEMORY] = _DefaultEventQueue.MEMORY,
        on_event_ack: OnAck | None = None,
        on_event_rejected: OnRejected | None = None,
        outpost: OutpostOptions | None = None,
    ) -> None:
        self._client = AsyncClientBase(
            base_url, self.version, access_token, timeout, organization_id
        )

        self._event_queue = (
            MemoryEventQueue()
            if event_queue is _DefaultEventQueue.MEMORY
            else event_queue
        )
        self._active_queue: EventQueue | None = None
        self._caller_on_ack = on_event_ack
        self._caller_on_rejected = on_event_rejected
        self.outpost = None
        if outpost is not None:
            from polar.outpost import Outpost

            self.outpost = Outpost.create(self, **outpost)
        self._stack = contextlib.AsyncExitStack()

    async def __aenter__(self) -> typing.Self:
        async with contextlib.AsyncExitStack() as stack:
            await stack.enter_async_context(self._client)
            if self.outpost is not None:
                await stack.enter_async_context(self.outpost)
            if self._event_queue is not None:
                self._active_queue = await stack.enter_async_context(
                    self._open_queue(self._event_queue)
                )
            self._stack = stack.pop_all()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None = None,
        exc_val: BaseException | None = None,
        exc_tb: types.TracebackType | None = None,
    ) -> None:
        self._active_queue = None
        await self._stack.__aexit__(exc_type, exc_val, exc_tb)

    async def flush(self, *, timeout: float = 30.0) -> None:
        """Wait for the configured queue to deliver earlier events."""
        queue = self._require_event_queue()
        validate_timeout(timeout)
        deadline = anyio.current_time() + timeout
        try:
            with anyio.fail_after(timeout):
                await queue.flush(timeout=timeout)
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
            RuntimeError: The client has no open event queue.
            ValueError: Customer or member identifiers are inconsistent.
        """
        queue = self._require_event_queue()
        validate_actor(
            event.get("customer_id"),
            event.get("member_id"),
            event.get("external_customer_id"),
            event.get("external_member_id"),
        )
        event.setdefault("timestamp", datetime.datetime.now(datetime.UTC).isoformat())
        if not event.get("external_id"):
            event["external_id"] = str(uuid.uuid4())
        actor_event = typing.cast(EventInput, event)
        await queue.enqueue(actor_event)
        if self.outpost is not None:
            try:
                await self.outpost.track(actor_event)
            except Exception as error:  # noqa: BLE001
                log.warning(
                    "Outpost failed to reduce an enqueued event (%s)",
                    type(error).__name__,
                )

    @typing.overload
    def actor(self, *, customer_id: str, member_id: str | None = None) -> Actor: ...

    @typing.overload
    def actor(
        self, *, external_customer_id: str, external_member_id: str | None = None
    ) -> Actor: ...

    def actor(
        self,
        *,
        customer_id: str | None = None,
        member_id: str | None = None,
        external_customer_id: str | None = None,
        external_member_id: str | None = None,
    ) -> Actor:
        """Create customer-bound helper.

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
        validate_actor(customer_id, member_id, external_customer_id, external_member_id)
        return Actor(
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
        validate_actor(customer_id, None, external_customer_id, None)
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

    def _require_event_queue(self) -> EventQueue:
        if self._event_queue is None:
            raise RuntimeError(
                "Configure an event_queue on PolarAsync to track or flush events"
            )
        if self._active_queue is None:
            raise RuntimeError("Use async with PolarAsync(...) to open the event queue")
        return self._active_queue

    def _open_queue(
        self, queue: EventQueue
    ) -> contextlib.AbstractAsyncContextManager[EventQueue]:
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
        if self.outpost is not None:
            from polar.metering.queue.redis import RedisEventQueue

            if (
                type(queue) is RedisEventQueue
                and queue.redis_url is not None
                and queue.redis_url == self.outpost.redis_url
            ):
                return queue._open(
                    self.outpost._require_redis(),
                    ingest=self._ingest,
                    on_ack=on_ack,
                    on_rejected=on_rejected,
                )
        return queue.open(ingest=self._ingest, on_ack=on_ack, on_rejected=on_rejected)

    async def _ingest(self, events: list[EventInput]) -> None:
        await ingest_events(self._client._client, events)

    async def _on_ack(self, events: list[EventInput]) -> None:
        if self.outpost is not None:
            await self.outpost.on_ack(events)
        if self._caller_on_ack is not None:
            try:
                await self._caller_on_ack(events)
            except Exception as error:  # noqa: BLE001
                log.warning(
                    "Event acknowledgement hook failed (%s)", type(error).__name__
                )

    async def _on_rejected(self, events: list[EventInput], reason: DropReason) -> None:
        if self.outpost is not None:
            await self.outpost.on_rejected(events, reason)
        if self._caller_on_rejected is not None:
            try:
                await self._caller_on_rejected(events, reason)
            except Exception as error:  # noqa: BLE001
                log.warning("Event rejection hook failed (%s)", type(error).__name__)


class SyncServiceBase:
    def __init__(self, client: SyncClientBase):
        self.client = client

    @classmethod
    def from_service(cls, service: "SyncServiceBase") -> typing.Self:
        return cls(service.client)


class AsyncServiceBase:
    def __init__(self, client: AsyncClientBase):
        self.client = client

    @classmethod
    def from_service(cls, service: "AsyncServiceBase") -> typing.Self:
        return cls(service.client)


def _load_exact_float(data: object) -> float:
    if type(data) is float:
        return data
    raise adaptix.load_error.TypeLoadError(float, data)


class _OpenEnumChecker(LocStackChecker):
    def check_loc_stack(self, mediator: object, loc_stack: LocStack) -> bool:
        hint = loc_stack.last.type
        return typing.get_origin(hint) is typing.Annotated and any(
            metadata is _OPEN_ENUM for metadata in typing.get_args(hint)[1:]
        )


def _load_open_enum(data: object) -> str:
    if isinstance(data, str):
        return data
    raise adaptix.load_error.TypeLoadError(str, data)


# Adaptix's float loader also accepts int, and union cases are tried in an
# order that puts float first, so int | float would always coerce to float.
# P[Union][float] targets float only as a member of that union (not standalone
# float fields, which should still coerce JSON ints).
_retort = adaptix.Retort(
    recipe=[
        _DiscriminatedUnionProvider(),
        _ScalarUnionProvider(),
        adaptix.loader(_OpenEnumChecker(), _load_open_enum),
        adaptix.loader(
            adaptix.P[int | float][float]
            | adaptix.P[int | float | None][float]
            | adaptix.P[str | int | float | bool][float],
            _load_exact_float,
        ),
    ]
)


def _register_extra_items_typed_dict(
    model: typing.Any,
    extra_items_type: typing_extensions.TypeForm[typing.Any],
) -> None:
    global _retort

    field_types = typing.get_type_hints(model, include_extras=True)
    required_keys = set(model.__required_keys__)
    for key, field_type in field_types.items():
        field_origin = typing.get_origin(field_type)
        if field_origin is typing.Required:
            required_keys.add(key)
        elif field_origin is typing.NotRequired:
            required_keys.discard(key)
        if field_origin in (typing.Required, typing.NotRequired):
            field_types[key] = typing.get_args(field_type)[0]

    def load_extra_items_typed_dict(data: object) -> dict[str, typing.Any]:
        if not isinstance(data, collections.abc.Mapping):
            raise adaptix.load_error.TypeLoadError(collections.abc.Mapping, data)

        missing_keys = required_keys - data.keys()
        if missing_keys:
            raise adaptix.load_error.NoRequiredFieldsLoadError(missing_keys, data)

        loaded: dict[str, typing.Any] = {}
        for key, value in data.items():
            if not isinstance(key, str):
                raise adaptix.load_error.TypeLoadError(str, key)
            if key in field_types:
                loaded[key] = _retort.load(value, field_types[key])
            else:
                loaded[key] = _retort.load(value, extra_items_type)
        return loaded

    _retort = _retort.extend(
        recipe=[adaptix.loader(model, load_extra_items_typed_dict)]
    )


def deserialize(data: object, model: typing_extensions.TypeForm[_ModelT]) -> _ModelT:
    try:
        return typing.cast(_ModelT, _retort.load(data, model))
    except adaptix.load_error.LoadError as e:
        raise PolarDeserializationError(e) from e


def _handle_errors(
    response: httpx2.Response,
    errors: collections.abc.Mapping[int, type[PolarClientError]] | None = None,
) -> None:
    status_code = response.status_code

    if response.is_server_error:
        raise PolarServerError(status_code, response.text)

    if response.is_client_error:
        if status_code == 429:
            retry_after = response.headers.get("Retry-After")
            if retry_after is not None or (errors or {}).get(429) is None:
                raise PolarRateLimitError(
                    429, int(retry_after) if retry_after is not None else None
                )
        try:
            error_class = (errors or {})[status_code]
            match error_class.error_type:
                case None:
                    raise error_class(status_code, None)
                case builtins.str:
                    raise error_class(status_code, response.text)
                case _:
                    raise error_class(
                        status_code,
                        deserialize(response.json(), error_class.error_type),
                    )
        except KeyError:
            raise PolarClientError(status_code, response.text)


def parse_response_json(
    response: httpx2.Response,
    response_model: typing.Any | None = None,
    errors: collections.abc.Mapping[int, type[PolarClientError]] | None = None,
) -> typing.Any:
    _handle_errors(response, errors)

    if not response.content:
        return None

    if response_model is not None:
        return deserialize(response.json(), response_model)

    return response.json()


def parse_response_text(
    response: httpx2.Response,
    errors: collections.abc.Mapping[int, type[PolarClientError]] | None = None,
) -> str:
    _handle_errors(response, errors)
    return response.text


def parse_response_none(
    response: httpx2.Response,
    errors: collections.abc.Mapping[int, type[PolarClientError]] | None = None,
) -> None:
    _handle_errors(response, errors)
