import dataclasses
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from polar.kit.versioning import (
    APIVersion,
    ExcludedIn,
    IncludedIn,
    add_versioned_routers,
    api_version_context,
    version,
)
from polar.routing import APIRouter

CURRENT_VERSION = APIVersion(2026, 4)
NEXT_VERSION = APIVersion(2026, 10)


class VersionedProduct(BaseModel):
    name: str
    shared_field: Annotated[str, IncludedIn(CURRENT_VERSION, NEXT_VERSION)] = "shared"
    current_field: Annotated[str, ExcludedIn(NEXT_VERSION)] = "current"
    next_field: Annotated[
        str,
        IncludedIn(NEXT_VERSION),
        Field(description="Only available in the next API version."),
    ] = "next"


class VersionedSubscription(BaseModel):
    product: VersionedProduct


def test_api_version_is_ordered_hashable_and_immutable() -> None:
    current = APIVersion(2026, 4)
    next = APIVersion(2026, 10)

    assert current < next
    assert len({current, APIVersion(2026, 4)}) == 1
    with pytest.raises(dataclasses.FrozenInstanceError):
        setattr(current, "month", 7)


def test_version_decorator_only_adds_metadata() -> None:
    api_version = APIVersion(2026, 10)

    def endpoint(value: int) -> int:
        return value + 1

    decorated_endpoint = version(api_version)(endpoint)

    assert decorated_endpoint is endpoint
    assert getattr(decorated_endpoint, "_api_versions") == frozenset({api_version})
    assert decorated_endpoint(1) == 2


def test_versioned_fields_are_serialized_for_requested_version() -> None:
    subscription = VersionedSubscription(product=VersionedProduct(name="Pro"))

    with api_version_context(CURRENT_VERSION):
        assert subscription.model_dump() == {
            "product": {
                "name": "Pro",
                "shared_field": "shared",
                "current_field": "current",
            }
        }

    with api_version_context(NEXT_VERSION):
        assert subscription.model_dump() == {
            "product": {
                "name": "Pro",
                "shared_field": "shared",
                "next_field": "next",
            }
        }


def test_versioned_fields_are_included_in_versioned_openapi_schema() -> None:
    with api_version_context(CURRENT_VERSION):
        current_schema = VersionedSubscription.model_json_schema()
    current_product = current_schema["$defs"]["VersionedProduct"]
    assert set(current_product["properties"]) == {
        "name",
        "shared_field",
        "current_field",
    }

    with api_version_context(NEXT_VERSION):
        next_schema = VersionedSubscription.model_json_schema()
    next_product = next_schema["$defs"]["VersionedProduct"]
    assert set(next_product["properties"]) == {"name", "shared_field", "next_field"}
    assert (
        next_product["properties"]["next_field"]["description"]
        == "Only available in the next API version."
    )


def test_versioned_routes() -> None:
    current_version = APIVersion(2026, 4)
    next_version = APIVersion(2026, 10)
    router = APIRouter()

    def dependency() -> str:
        return "original"

    @router.get("/items")
    async def general_endpoint(
        value: Annotated[str, Depends(dependency)],
    ) -> dict[str, str]:
        return {"endpoint": "general", "dependency": value}

    @router.get("/items")
    @version(next_version)
    async def next_endpoint(
        value: Annotated[str, Depends(dependency)],
    ) -> dict[str, str]:
        return {"endpoint": "next", "dependency": value}

    @router.get("/next-only")
    @version(next_version)
    async def next_only_endpoint() -> str:
        return "next-only"

    app = FastAPI(openapi_url=None)
    add_versioned_routers(
        app, router, [], [current_version, next_version], current_version
    )
    app.dependency_overrides[dependency] = lambda: "overridden"
    client = TestClient(app)

    response = client.get("/items")
    assert response.json() == {"endpoint": "general", "dependency": "overridden"}
    assert response.headers["Polar-Version"] == "2026-04"

    response = client.get("/items", headers={"Polar-Version": "2026-10"})
    assert response.json() == {"endpoint": "next", "dependency": "overridden"}
    assert response.headers["Polar-Version"] == "2026-10"

    assert client.get("/next-only").status_code == 404
    assert (
        client.get("/next-only", headers={"Polar-Version": "2026-10"}).status_code
        == 200
    )


def test_rejects_ambiguous_exact_routes() -> None:
    next_version = APIVersion(2026, 10)
    router = APIRouter()

    @router.get("/items")
    @version(next_version)
    async def first_endpoint() -> str:
        return "first"

    @router.get("/items")
    @version(next_version)
    async def second_endpoint() -> str:
        return "second"

    with pytest.raises(ValueError, match="Multiple routes match API version 2026-10"):
        add_versioned_routers(
            FastAPI(openapi_url=None),
            router,
            [],
            [next_version],
            next_version,
        )
