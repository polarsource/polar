import dataclasses
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from polar.kit.versioning import APIVersion, add_versioned_routers, version
from polar.routing import APIRouter


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
    add_versioned_routers(app, router, [current_version, next_version], current_version)
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
            [next_version],
            next_version,
        )
