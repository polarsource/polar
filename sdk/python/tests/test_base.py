from __future__ import annotations

import dataclasses
import datetime
import subprocess
import sys
import typing
from unittest.mock import AsyncMock, MagicMock

import adaptix
import anyio
import httpx
import httpx2
import pytest
import typing_extensions

from polar import PolarClientError, PolarDeserializationError, deserialize
from polar.base import (
    _OPEN_ENUM,
    AsyncClientBase,
    SyncClientBase,
    _DiscriminatedUnionProvider,
    _Discriminator,
    _register_extra_items_typed_dict,
    parse_response_json,
    resolve_base_url,
)
from polar.metering.errors import (
    IngestRejectedError,
    MeteringDeliveryError,
    MeteringTimeoutError,
)
from polar.metering.meter import CustomerMeter
from polar.metering.queue import EventQueue
from polar.metering.queue.memory import MemoryEventQueue
from polar.outpost import Outpost
from polar.outpost.errors import NotReadyError, UnavailableRedisError
from polar.v2026_04 import Polar, PolarAsync

SERVERS = {
    "production": "https://api.polar.sh",
    "sandbox": "https://sandbox-api.polar.sh",
}


@dataclasses.dataclass
class Cat:
    type: typing.Literal["cat"]
    lives: int


@dataclasses.dataclass
class Dog:
    type: typing.Literal["dog"]
    breed: str


Animal: typing.TypeAlias = Cat | Dog

TaggedAnimal: typing.TypeAlias = typing.Annotated[
    Cat | Dog, _Discriminator("type", (("cat", Cat), ("dog", Dog)))
]


@dataclasses.dataclass
class AnimalGroup:
    animals: list[TaggedAnimal | None]
    child: AnimalGroup | None = None


def test_discriminator_dispatches_without_trying_other_variants() -> None:
    def load_cat(data: object) -> Cat:
        pytest.fail("The cat loader must not run for a dog")

    retort = adaptix.Retort(
        recipe=[_DiscriminatedUnionProvider(), adaptix.loader(Cat, load_cat)]
    )
    assert retort.load({"type": "dog", "breed": "Samoyed"}, TaggedAnimal) == Dog(
        "dog", "Samoyed"
    )


def test_nested_discriminated_union() -> None:
    result = deserialize(
        {
            "animals": [{"type": "cat", "lives": 9}, None],
            "child": {"animals": [{"type": "dog", "breed": "Samoyed"}]},
        },
        AnimalGroup,
    )
    assert result == AnimalGroup(
        [Cat("cat", 9), None], AnimalGroup([Dog("dog", "Samoyed")])
    )


@pytest.mark.parametrize(
    "hint",
    [
        TaggedAnimal | None,
        typing.Annotated[
            Cat | Dog | None, _Discriminator("type", (("cat", Cat), ("dog", Dog)))
        ],
    ],
)
def test_nullable_discriminated_union(hint: typing.Any) -> None:
    assert deserialize(None, hint) is None
    assert deserialize({"type": "cat", "lives": 9}, hint) == Cat("cat", 9)


@pytest.mark.parametrize(
    "data",
    [None, [], {}, {"type": "unknown"}, {"type": []}, {"type": "dog", "breed": 42}],
)
def test_discriminated_union_rejects_invalid_data(data: object) -> None:
    with pytest.raises(PolarDeserializationError):
        deserialize(data, TaggedAnimal)


@pytest.mark.parametrize("value", [None, [], {}, b"text"])
def test_scalar_union_rejects_invalid_data(value: object) -> None:
    with pytest.raises(PolarDeserializationError):
        deserialize(value, str | int | float | bool)


def test_scalar_union_preserves_fallback_behavior() -> None:
    class CustomInt(int):
        pass

    with pytest.raises(PolarDeserializationError):
        deserialize(CustomInt(42), int | float)
    assert type(deserialize(7, str | float)) is float
    assert deserialize(7, str | float) == 7.0
    with pytest.raises(PolarDeserializationError):
        deserialize(True, int | float)


@dataclasses.dataclass
class AnimalTree:
    type: typing.Literal["tree"]
    children: list[AnimalTreeEntry]


AnimalTreeEntry: typing.TypeAlias = typing.Annotated[
    AnimalTree | Cat,
    _Discriminator("type", (("tree", AnimalTree), ("cat", Cat))),
]


def test_recursive_discriminated_union() -> None:
    assert deserialize(
        {"type": "tree", "children": [{"type": "cat", "lives": 9}]},
        AnimalTreeEntry,
    ) == AnimalTree("tree", [Cat("cat", 9)])


@dataclasses.dataclass
class ExtensibleDetails:
    name: str


class ExtensibleModel(
    typing_extensions.TypedDict,
    extra_items=str | int | float | bool,
):
    known: int
    details: typing.NotRequired[ExtensibleDetails]


_register_extra_items_typed_dict(
    ExtensibleModel,
    str | int | float | bool,
)


def test_deserialize_model() -> None:
    cat = deserialize({"type": "cat", "lives": 9}, Cat)

    typing.assert_type(cat, Cat)
    assert cat == Cat(type="cat", lives=9)


def test_deserialize_model_invalid() -> None:
    with pytest.raises(PolarDeserializationError):
        deserialize({"type": "cat", "lives": "nine"}, Cat)


def test_deserialize_union() -> None:
    animal = deserialize({"type": "dog", "breed": "Samoyed"}, Animal)

    typing.assert_type(animal, Cat | Dog)
    assert animal == Dog(type="dog", breed="Samoyed")


def test_deserialize_model_with_additional_properties() -> None:
    model = deserialize(
        {
            "known": 1,
            "details": {"name": "example"},
            "custom": "value",
        },
        ExtensibleModel,
    )

    assert model == {
        "known": 1,
        "details": ExtensibleDetails(name="example"),
        "custom": "value",
    }


def test_deserialize_model_without_optional_fields() -> None:
    model = deserialize({"known": 1, "custom": "value"}, ExtensibleModel)

    assert model == {"known": 1, "custom": "value"}


def test_deserialize_model_with_invalid_additional_property() -> None:
    with pytest.raises(PolarDeserializationError):
        deserialize({"known": 1, "invalid": ["value"]}, ExtensibleModel)


@pytest.mark.parametrize(
    ("value", "expected_type"),
    [
        (42, int),
        (99.5, float),
    ],
)
def test_deserialize_int_float_union_preserves_json_type(
    value: object, expected_type: type
) -> None:
    result = deserialize(value, int | float)
    assert type(result) is expected_type
    assert result == value


def test_deserialize_int_float_optional_field() -> None:
    @dataclasses.dataclass
    class Metric:
        orders: int | float | None = None
        revenue: int | float | None = None

    result = deserialize({"orders": 42, "revenue": 99.5}, Metric)
    assert type(result.orders) is int
    assert result.orders == 42
    assert type(result.revenue) is float
    assert result.revenue == 99.5


def test_deserialize_json_scalar_union_preserves_int() -> None:
    result = deserialize(
        {"count": 1, "ratio": 1.5, "name": "x", "ok": True},
        dict[str, str | int | float | bool],
    )
    assert type(result["count"]) is int
    assert result["count"] == 1
    assert type(result["ratio"]) is float
    assert type(result["name"]) is str
    assert type(result["ok"]) is bool


def test_deserialize_float_still_coerces_int() -> None:
    result = deserialize(7, float)
    assert type(result) is float
    assert result == 7.0


@pytest.mark.parametrize(
    ("environment", "base_url", "expected"),
    [
        ("production", None, "https://api.polar.sh"),
        ("sandbox", None, "https://sandbox-api.polar.sh"),
        ("invalid", "http://localhost:8000", "http://localhost:8000"),
    ],
)
def test_resolve_base_url(
    environment: str, base_url: str | None, expected: str
) -> None:
    assert resolve_base_url(SERVERS, environment, base_url) == expected


def test_resolve_base_url_invalid_environment() -> None:
    with pytest.raises(ValueError, match="Invalid environment 'invalid'"):
        resolve_base_url(SERVERS, "invalid", None)


@pytest.fixture(params=[SyncClientBase, AsyncClientBase])
def client(request) -> SyncClientBase | AsyncClientBase:
    cls = request.param
    return cls(
        base_url="https://api.polar.sh",
        version="2026-04",
        access_token="polar_at_u_xxx",
    )


class TestBuildRequest:
    def test_client_timeout(self, client: SyncClientBase | AsyncClientBase) -> None:
        request = client.build_request(method="GET", url="/v1/items/")

        assert request.extensions["timeout"] == {
            "connect": 5.0,
            "read": 5.0,
            "write": 5.0,
            "pool": 5.0,
        }

    def test_request_timeout_override(
        self, client: SyncClientBase | AsyncClientBase
    ) -> None:
        request = client.build_request(
            method="GET", url="/v1/items/", request_timeout=30.0
        )

        assert request.extensions["timeout"] == {
            "connect": 30.0,
            "read": 30.0,
            "write": 30.0,
            "pool": 30.0,
        }

    def test_request_access_token_override(
        self, client: SyncClientBase | AsyncClientBase
    ) -> None:
        request = client.build_request(
            method="GET",
            url="/v1/items/",
            request_access_token="polar_at_u_override",
        )

        assert request.headers["Authorization"] == "Bearer polar_at_u_override"

    @pytest.mark.parametrize("client_class", [SyncClientBase, AsyncClientBase])
    @pytest.mark.parametrize("timeout_class", [httpx.Timeout, httpx2.Timeout])
    def test_advanced_client_timeout(
        self,
        client_class: type[SyncClientBase | AsyncClientBase],
        timeout_class: type[httpx.Timeout | httpx2.Timeout],
    ) -> None:
        client = client_class(
            base_url="https://api.polar.sh",
            version="2026-04",
            access_token="polar_at_u_xxx",
            timeout=timeout_class(30.0, connect=10.0),
        )

        request = client.build_request(method="GET", url="/v1/items/")

        assert request.extensions["timeout"] == {
            "connect": 10.0,
            "read": 30.0,
            "write": 30.0,
            "pool": 30.0,
        }

        override = client.build_request(
            method="GET",
            url="/v1/items/",
            request_timeout=timeout_class(None, pool=2.0),
        )

        assert override.extensions["timeout"] == {
            "connect": None,
            "read": None,
            "write": None,
            "pool": 2.0,
        }

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ({"id": "value"}, "https://api.polar.sh/v1/items/value"),
            ({"id": 123}, "https://api.polar.sh/v1/items/123"),
            (
                {"id": "value with spaces"},
                "https://api.polar.sh/v1/items/value%20with%20spaces",
            ),
        ],
    )
    def test_path_params(
        self,
        value: dict[str, typing.Any],
        expected: str,
        client: SyncClientBase | AsyncClientBase,
    ) -> None:
        request = client.build_request(
            method="GET",
            url="/v1/items/{id}",
            path_params=value,
        )
        assert request.method == "GET"
        assert str(request.url) == expected

    def test_query_params(self, client: SyncClientBase | AsyncClientBase) -> None:
        request = client.build_request(
            method="GET",
            url="/v1/items/",
            query_params={
                "string_param": "value",
                "bool_param": True,
                "int_param": 42,
                "list_param": ["a", "b", "c"],
                "dict_param": {"key": "value"},
            },
        )
        assert request.method == "GET"
        assert (
            str(request.url)
            == "https://api.polar.sh/v1/items/?string_param=value&bool_param=true&int_param=42&list_param=a&list_param=b&list_param=c&dict_param%5Bkey%5D=value"
        )

    def test_query_params_inner_none_in_dict_dropped(
        self, client: SyncClientBase | AsyncClientBase
    ) -> None:
        request = client.build_request(
            method="GET",
            url="/v1/items/",
            query_params={"metadata": {"key": None}},
        )
        assert request.method == "GET"
        assert str(request.url) == "https://api.polar.sh/v1/items/"

    def test_query_params_mixed_inner_none_in_dict(
        self, client: SyncClientBase | AsyncClientBase
    ) -> None:
        request = client.build_request(
            method="GET",
            url="/v1/items/",
            query_params={"metadata": {"dropped": None, "kept": "value"}},
        )
        assert request.method == "GET"
        assert (
            str(request.url)
            == "https://api.polar.sh/v1/items/?metadata%5Bkept%5D=value"
        )


class TestOrganization:
    def test_omitted_by_default(self, client: SyncClientBase | AsyncClientBase) -> None:
        request = client.build_request(method="GET", url="/v1/items/")

        assert "Polar-Organization" not in request.headers

    @pytest.mark.parametrize("client_class", [SyncClientBase, AsyncClientBase])
    def test_configured_organization(
        self, client_class: type[SyncClientBase | AsyncClientBase]
    ) -> None:
        client = client_class(
            base_url="https://api.polar.sh",
            version="2026-04",
            access_token="polar_at_u_xxx",
            organization_id="org_1",
        )

        request = client.build_request(method="GET", url="/v1/items/")

        assert request.headers["Polar-Organization"] == "org_1"

    @pytest.mark.parametrize("polar_class", [Polar, PolarAsync])
    def test_polar_organization(self, polar_class: type[Polar | PolarAsync]) -> None:
        polar = polar_class("polar_at_u_xxx", organization_id="org_1")

        request = polar._client.build_request(method="GET", url="/v1/items/")

        assert request.headers["Polar-Organization"] == "org_1"


def test_user_agent(client: SyncClientBase | AsyncClientBase) -> None:
    request = client.build_request(method="GET", url="/v1/items/")

    assert request.headers["User-Agent"] == "polar-sdk-python/1.3.3"


def test_parse_response_json_empty_body() -> None:
    response = httpx2.Response(202, headers={"Content-Type": "application/json"})

    assert parse_response_json(response) is None


OrderStatus: typing.TypeAlias = typing.Annotated[
    typing.Literal["pending", "paid"], _OPEN_ENUM
]


@dataclasses.dataclass
class Order:
    type: typing.Literal["order"]
    statuses: list[OrderStatus | None]


def test_parse_response_json_preserves_unknown_enum_value() -> None:
    statuses = ["paid", "requires_review", None]
    response = httpx2.Response(200, json={"type": "order", "statuses": statuses})

    order = parse_response_json(response, Order)

    assert order.statuses == statuses


@pytest.mark.parametrize(
    "payload",
    [
        {"type": "order", "statuses": [42]},
        {"type": "refund", "statuses": ["requires_review"]},
    ],
)
def test_parse_response_json_open_enum_preserves_other_validation(
    payload: dict[str, object],
) -> None:
    with pytest.raises(PolarDeserializationError):
        parse_response_json(httpx2.Response(200, json=payload), Order)


@pytest.mark.parametrize(
    "hint",
    [
        typing.Literal["pending", "paid"],
        typing.Annotated[typing.Literal["pending", "paid"], object()],
    ],
)
def test_deserialize_enum_without_marker_stays_closed(hint: typing.Any) -> None:
    with pytest.raises(PolarDeserializationError):
        deserialize("requires_review", hint)


@pytest.mark.parametrize("tag", ["type", "duration"])
def test_checkout_discount_rejects_unknown_discriminator(tag: str) -> None:
    from polar.v2026_04.outputs import (
        CheckoutDiscountFixedOnceForeverDuration,
    )

    payload = {
        "id": "discount_1",
        "name": "Discount",
        "code": None,
        "type": "fixed",
        "duration": "once",
        "currency": "usd",
        "amount": 100,
        "amounts": {"usd": 100},
    }
    assert (
        deserialize(payload, CheckoutDiscountFixedOnceForeverDuration).type == "fixed"
    )

    with pytest.raises(PolarDeserializationError):
        deserialize(
            {**payload, tag: "future"}, CheckoutDiscountFixedOnceForeverDuration
        )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "identity",
    [
        {},
        {"customer_id": "customer", "external_customer_id": "customer"},
        {"member_id": "member"},
        {"external_member_id": "member"},
        {"customer_id": "customer", "external_member_id": "member"},
        {"external_customer_id": "customer", "member_id": "member"},
    ],
)
async def test_invalid_actor(identity: dict[str, typing.Any]) -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    async with PolarAsync("token", event_queue=queue) as polar:
        with pytest.raises(ValueError):
            polar.actor(**identity)

        with pytest.raises(ValueError):
            await polar.track(name="usage", **identity)
        queue.enqueue.assert_not_awaited()


def test_actor_without_outpost_dependencies() -> None:
    subprocess.run(
        [
            sys.executable,
            "-c",
            """
import asyncio
import sys
import typing
import httpx2

sys.modules["polar.outpost"] = None
sys.modules["redis"] = None
sys.modules["opentelemetry"] = None

from polar.v2026_04 import PolarAsync

assert "outpost" in typing.get_type_hints(PolarAsync.__init__)

async def main():
    async with PolarAsync("token") as polar:
        async def post(*args, **kwargs):
            return httpx2.Response(202, request=httpx2.Request("POST", "https://polar.test"))
        polar._client._client.post = post
        actor = polar.actor(external_customer_id="customer")
        await actor.track(name="usage")

asyncio.run(main())
""",
        ],
        check=True,
        capture_output=True,
        text=True,
    )


@pytest.mark.anyio
@pytest.mark.parametrize("external", [False, True])
@pytest.mark.parametrize("missing", [False, True])
async def test_meter_api_fallback(
    monkeypatch: pytest.MonkeyPatch, external: bool, missing: bool
) -> None:
    value = {
        "meter_id": "meter",
        "customer_id": "customer",
        "consumed_units": 3,
        "credited_units": 10,
        "balance": 7,
        "id": "customer-meter",
    }
    send = AsyncMock(
        return_value=httpx2.Response(
            200,
            json={
                "items": [] if missing else [value],
                "pagination": {"total_count": 1, "max_page": 1},
            },
        )
    )
    async with PolarAsync("token", organization_id="org") as polar:
        monkeypatch.setattr(polar._client, "send_request", send)
        if external:
            actor = polar.actor(external_customer_id="external")
            result = await actor.meter("meter")
        else:
            result = await polar.meter(meter_id="meter", customer_id="customer")
    if missing:
        assert result is None
    else:
        assert result == CustomerMeter(
            meter_id="meter",
            customer_id="customer",
            consumed_units=3,
            credited_units=10,
            balance=7,
        )
    request = send.call_args.args[0]
    assert request.url.path == "/v1/customer-meters/"
    assert request.url.params["meter_id"] == "meter"
    key = "external_customer_id" if external else "customer_id"
    assert request.url.params[key] == ("external" if external else "customer")
    assert request.headers["Authorization"] == "Bearer token"
    assert request.headers["Polar-Organization"] == "org"


@pytest.mark.anyio
async def test_meter_api_error_propagates(monkeypatch: pytest.MonkeyPatch) -> None:
    async with PolarAsync("token") as polar:
        monkeypatch.setattr(
            polar._client,
            "send_request",
            AsyncMock(return_value=httpx2.Response(403, text="Forbidden")),
        )
        with pytest.raises(PolarClientError):
            await polar.meter(meter_id="meter", external_customer_id="customer")


@pytest.mark.anyio
async def test_uses_active_queue_returned_by_open() -> None:
    queue = MagicMock(spec=EventQueue)
    active = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = active

    async with PolarAsync("token", event_queue=queue) as polar:
        await polar.track(name="usage", external_customer_id="alice")
        await polar.flush()

    active.enqueue.assert_awaited_once()
    active.flush.assert_awaited_once_with(timeout=30.0)
    queue.enqueue.assert_not_awaited()
    queue.flush.assert_not_awaited()


@pytest.mark.anyio
async def test_flush_enforces_timeout_for_custom_queue() -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    queue.flush = AsyncMock()

    async def flush(*, timeout: float = 30.0) -> None:
        await anyio.sleep_forever()

    queue.flush.side_effect = flush
    async with PolarAsync("token", event_queue=queue) as polar:
        with anyio.fail_after(1), pytest.raises(MeteringTimeoutError):
            await polar.flush(timeout=0.01)


@pytest.mark.anyio
async def test_context_preserves_body_and_delivery_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    body_error = ValueError("body failed")
    response = httpx2.Response(
        422,
        text="rejected",
        request=httpx2.Request("POST", "https://polar.test/v1/events/ingest"),
    )
    with pytest.raises(ExceptionGroup) as failure:
        async with PolarAsync("token", event_queue=MemoryEventQueue()) as polar:
            monkeypatch.setattr(
                polar._client._client, "post", AsyncMock(return_value=response)
            )
            await polar.track(name="usage", external_customer_id="customer")
            raise body_error
    assert failure.value.exceptions[0] is body_error
    delivery = failure.value.exceptions[1]
    assert isinstance(delivery, MeteringDeliveryError)
    cause = delivery.failures[0].cause
    assert isinstance(cause, IngestRejectedError)
    assert isinstance(cause.__cause__, httpx2.HTTPStatusError)
    assert cause.__cause__.response is response


@pytest.mark.anyio
@pytest.mark.parametrize("status", [202, 422])
async def test_metering_reports_delivery_outcomes_without_outpost(
    status: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    response = httpx2.Response(
        status, request=httpx2.Request("POST", "https://polar.test/v1/events/ingest")
    )
    on_ack, on_rejected = AsyncMock(), AsyncMock()
    async with PolarAsync(
        "token", on_event_ack=on_ack, on_event_rejected=on_rejected
    ) as polar:
        post = AsyncMock(return_value=response)
        monkeypatch.setattr(polar._client._client, "post", post)
        await polar.track(name="usage", external_customer_id="alice")
        if status == 202:
            await polar.flush()
            assert post.await_args is not None
            on_ack.assert_awaited_once_with(post.await_args.kwargs["json"]["events"])
            on_rejected.assert_not_awaited()
        else:
            with pytest.raises(MeteringDeliveryError) as failure:
                await polar.flush()
            on_rejected.assert_awaited_once_with(
                failure.value.events, "permanent_error"
            )
            on_ack.assert_not_awaited()


@pytest.mark.anyio
@pytest.mark.parametrize("hook_fails", [False, True])
async def test_metering_wires_hooks_and_reduces_the_enqueued_event(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    hook_fails: bool,
) -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    consumed = CustomerMeter(
        meter_id="meter", consumed_units=3, credited_units=10, balance=7
    )
    monkeypatch.setattr(
        Outpost, "__aenter__", AsyncMock(side_effect=lambda outpost: outpost)
    )
    monkeypatch.setattr(Outpost, "__aexit__", AsyncMock())
    track, ack, rejected = AsyncMock(), AsyncMock(), AsyncMock()
    monkeypatch.setattr(Outpost, "track", track)
    monkeypatch.setattr(Outpost, "actor", AsyncMock())
    monkeypatch.setattr(Outpost, "on_ack", ack)
    monkeypatch.setattr(Outpost, "on_rejected", rejected)
    monkeypatch.setattr(Outpost, "meter", AsyncMock(return_value=consumed))

    caller_error = RuntimeError("private event data") if hook_fails else None
    caller_ack = AsyncMock(side_effect=caller_error)
    caller_rejected = AsyncMock(side_effect=caller_error)
    hooks_order = MagicMock()
    hooks_order.attach_mock(caller_ack, "caller_ack")
    hooks_order.attach_mock(ack, "outpost_ack")
    hooks_order.attach_mock(caller_rejected, "caller_rejected")
    hooks_order.attach_mock(rejected, "outpost_rejected")

    async with PolarAsync(
        "token",
        event_queue=queue,
        outpost={"redis": "redis://localhost"},
        on_event_ack=caller_ack,
        on_event_rejected=caller_rejected,
    ) as polar:
        actor = polar.actor(external_customer_id="alice")
        await actor.track(name="usage")
        event = queue.enqueue.await_args.args[0]
        assert event["external_id"]
        assert datetime.datetime.fromisoformat(event["timestamp"]).tzinfo is not None
        track.assert_awaited_once_with(event)
        queue.open.assert_called_once_with(
            ingest=polar._ingest, on_ack=polar._on_ack, on_rejected=polar._on_rejected
        )
        hooks = queue.open.call_args.kwargs
        await hooks["on_ack"]([event])
        await hooks["on_rejected"]([event], "permanent_error")
        ack.assert_awaited_once_with([event])
        rejected.assert_awaited_once_with([event], "permanent_error")
        assert [entry[0] for entry in hooks_order.mock_calls] == [
            "outpost_ack",
            "caller_ack",
            "outpost_rejected",
            "caller_rejected",
        ]
        caller_ack.assert_awaited_once_with([event])
        caller_rejected.assert_awaited_once_with([event], "permanent_error")
        assert await actor.meter("meter") == consumed
    if hook_fails:
        assert "Event acknowledgement hook failed (RuntimeError)" in caplog.messages
        assert "Event rejection hook failed (RuntimeError)" in caplog.messages
        assert "private event data" not in caplog.text


@pytest.mark.anyio
async def test_enqueue_failure_skips_reduction_and_reduction_failure_is_logged(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue = AsyncMock(spec=EventQueue)
    queue.open.return_value.__aenter__.return_value = queue
    outpost = AsyncMock(spec=Outpost)
    monkeypatch.setattr(Outpost, "create", MagicMock(return_value=outpost))
    outpost.__aenter__.return_value = outpost
    async with PolarAsync(
        "token", event_queue=queue, outpost={"redis": "redis://localhost"}
    ) as polar:
        queue.enqueue.side_effect = RuntimeError("enqueue failed")
        with pytest.raises(RuntimeError, match="enqueue failed"):
            await polar.track(name="usage", external_customer_id="alice")
        outpost.track.assert_not_awaited()

        queue.enqueue.side_effect = None
        failure = UnavailableRedisError()
        failure.__cause__ = RuntimeError("private event details")
        outpost.track.side_effect = failure
        await polar.track(name="usage", external_customer_id="alice")
        assert (
            "Outpost failed to reduce an enqueued event (UnavailableRedisError)"
            in caplog.messages
        )
        assert "private event details" not in caplog.text


@pytest.mark.anyio
async def test_meter_uses_api_when_outpost_cannot_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    outpost = AsyncMock(spec=Outpost)
    monkeypatch.setattr(Outpost, "create", MagicMock(return_value=outpost))
    outpost.__aenter__.return_value = outpost
    outpost.meter.side_effect = NotReadyError("no snapshot yet")
    async with PolarAsync(
        "token", event_queue=None, outpost={"redis": "redis://localhost"}
    ) as polar:
        send = AsyncMock(return_value=httpx2.Response(200, json={"items": []}))
        monkeypatch.setattr(polar._client, "send_request", send)
        assert await polar.actor(external_customer_id="alice").meter("meter") is None
        with pytest.raises(RuntimeError, match="Configure an event_queue"):
            await polar.actor(external_customer_id="alice").track(name="usage")
        outpost.track.assert_not_awaited()
        send.assert_awaited_once()
    outpost.__aenter__.assert_awaited_once()
    outpost.__aexit__.assert_awaited_once()


@pytest.mark.anyio
async def test_track_requires_open_queue() -> None:
    polar = PolarAsync("token", event_queue=MemoryEventQueue())
    with pytest.raises(RuntimeError, match="Use async with PolarAsync"):
        await polar.track(name="usage", external_customer_id="alice")
    async with polar:
        pass
    with pytest.raises(RuntimeError, match="Use async with PolarAsync"):
        await polar.track(name="usage", external_customer_id="alice")


@pytest.mark.anyio
async def test_queue_startup_failure_closes_outpost_and_http_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue = MagicMock(spec=EventQueue)
    queue.open.return_value.__aenter__.side_effect = RuntimeError("queue failed")
    outpost = AsyncMock(spec=Outpost)
    monkeypatch.setattr(Outpost, "create", MagicMock(return_value=outpost))
    polar = PolarAsync(
        "token", event_queue=queue, outpost={"redis": "redis://localhost"}
    )

    with pytest.raises(RuntimeError, match="queue failed"):
        async with polar:
            pytest.fail("Client started despite queue startup failure")

    outpost.__aexit__.assert_awaited_once()
    assert polar._client._client.is_closed
