import dataclasses
import typing

import pytest

from polar import deserialize
from polar.base import AsyncClientBase, SyncClientBase, resolve_base_url

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


def test_deserialize_model() -> None:
    cat = deserialize({"type": "cat", "lives": 9}, Cat)

    typing.assert_type(cat, Cat)
    assert cat == Cat(type="cat", lives=9)


def test_deserialize_union() -> None:
    animal = deserialize({"type": "dog", "breed": "Samoyed"}, Animal)

    typing.assert_type(animal, Cat | Dog)
    assert animal == Dog(type="dog", breed="Samoyed")


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
