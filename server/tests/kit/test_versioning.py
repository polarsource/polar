import dataclasses
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from polar.kit.versioning import (
    APIVersion,
    Version,
    add_versioned_routers,
    api_version_context,
    routes_for_version,
    version,
)
from polar.openapi import APITag
from polar.routing import APIRouter

CURRENT_VERSION = APIVersion(2026, 4)
NEXT_VERSION = APIVersion(2026, 10)


class VersionedProduct(BaseModel):
    name: str
    shared_field: Annotated[
        str, Version(starting_from=CURRENT_VERSION, up_to=NEXT_VERSION)
    ] = "shared"
    current_field: Annotated[str, Version(up_to=CURRENT_VERSION)] = "current"
    next_field: Annotated[
        str,
        Version(starting_from=NEXT_VERSION),
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

    decorated_endpoint = version(starting_from=api_version)(endpoint)

    assert decorated_endpoint is endpoint
    version_range = getattr(decorated_endpoint, "_api_version_range")
    assert version_range.starting_from == api_version
    assert version_range.up_to is None
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
    router = APIRouter(tags=["items", APITag.public])

    def dependency() -> str:
        return "original"

    @router.get("/items")
    async def get_items(
        value: Annotated[str, Depends(dependency)],
    ) -> dict[str, str]:
        return {"endpoint": "current", "dependency": value}

    @router.get("/items", name="get_items")
    @version(starting_from=next_version)
    async def get_items_v2026_10(
        value: Annotated[str, Depends(dependency)],
    ) -> dict[str, str]:
        return {"endpoint": "next", "dependency": value}

    @router.get("/next-only")
    @version(starting_from=next_version)
    async def next_only_endpoint() -> str:
        return "next-only"

    app = FastAPI(openapi_url=None)
    add_versioned_routers(
        app, router, [], [current_version, next_version], current_version
    )
    app.dependency_overrides[dependency] = lambda: "overridden"
    client = TestClient(app)

    response = client.get("/items")
    assert response.json() == {"endpoint": "current", "dependency": "overridden"}
    assert response.headers["Polar-Version"] == "2026-04"

    response = client.get("/items", headers={"Polar-Version": "2026-10"})
    assert response.json() == {"endpoint": "next", "dependency": "overridden"}
    assert response.headers["Polar-Version"] == "2026-10"

    assert client.get("/next-only").status_code == 404
    assert (
        client.get("/next-only", headers={"Polar-Version": "2026-10"}).status_code
        == 200
    )

    for api_version in (current_version, next_version):
        schema = get_openapi(
            title="Test",
            version=str(api_version),
            routes=routes_for_version(app.routes, api_version),
        )
        operation = schema["paths"]["/items"]["get"]
        assert operation["operationId"] == "items:get_items"
        assert operation["x-speakeasy-name-override"] == "get_items"


def test_rejects_overlapping_versioned_routes() -> None:
    next_version = APIVersion(2026, 10)
    router = APIRouter()

    @router.get("/items")
    @version(starting_from=next_version)
    async def first_endpoint() -> str:
        return "first"

    @router.get("/items")
    @version(up_to=next_version)
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
