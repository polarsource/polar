import dataclasses
import typing

import httpx
import pytest
import typing_extensions

from polar import deserialize, PolarDeserializationError
from polar.base import (
    AsyncClientBase,
    SyncClientBase,
    _register_extra_items_typed_dict,
    resolve_base_url,
)

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
    return cls(base_url="https://api.polar.sh", version="2026-04", access_token="polar_at_u_xxx")


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
    def test_advanced_client_timeout(
        self,
        client_class: type[SyncClientBase] | type[AsyncClientBase],
    ) -> None:
        client = client_class(
            base_url="https://api.polar.sh",
            version="2026-04",
            access_token="polar_at_u_xxx",
            timeout=httpx.Timeout(30.0, connect=10.0),
        )

        request = client.build_request(method="GET", url="/v1/items/")

        assert request.extensions["timeout"] == {
            "connect": 10.0,
            "read": 30.0,
            "write": 30.0,
            "pool": 30.0,
        }

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ({"id": "value"}, "https://api.polar.sh/v1/items/value"),
            ({"id": 123}, "https://api.polar.sh/v1/items/123"),
            ({"id": "value with spaces"}, "https://api.polar.sh/v1/items/value%20with%20spaces"),
        ]
    )
    def test_path_params(self, value: dict[str, typing.Any], expected: str, client: SyncClientBase | AsyncClientBase) -> None:
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
            query_params={"string_param": "value", "bool_param": True, "int_param": 42, "list_param": ["a", "b", "c"], "dict_param": {"key": "value"}},
        )
        assert request.method == "GET"
        assert str(request.url) == "https://api.polar.sh/v1/items/?string_param=value&bool_param=true&int_param=42&list_param=a&list_param=b&list_param=c&dict_param%5Bkey%5D=value"
