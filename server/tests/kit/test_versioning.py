import dataclasses
from typing import Annotated, Any, Literal

import pytest
from fastapi import Depends, FastAPI, Request
from fastapi.openapi.utils import get_openapi
from fastapi.routing import iter_route_contexts
from fastapi.testclient import TestClient
from pydantic import (
    BaseModel,
    ConfigDict,
    Discriminator,
    Field,
    PlainSerializer,
    Tag,
    computed_field,
)

from polar.kit.versioning import (
    APIVersion,
    Version,
    add_versioned_routers,
    api_version_context,
    prune_version_omitted_schemas,
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
    ]
    current_field: Annotated[str, Version(up_to=CURRENT_VERSION)]
    next_field: Annotated[
        str,
        Version(starting_from=NEXT_VERSION),
        Field(description="Only available in the next API version."),
    ]


class VersionedSubscription(BaseModel):
    product: VersionedProduct


class NextOnlyDiscount(BaseModel):
    code: str


class VersionedOrder(BaseModel):
    discount: Annotated[NextOnlyDiscount | None, Version(starting_from=NEXT_VERSION)]


class Opaque:
    pass


class OutputOnlyCoupon(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    value: Annotated[Opaque, PlainSerializer(lambda _: "opaque", return_type=str)]


class LegacyOrder(BaseModel):
    coupon: Annotated[OutputOnlyCoupon | None, Version(up_to=CURRENT_VERSION)]


class CurrentOnlyPrice(BaseModel):
    kind: Literal["current"] = "current"


class SharedPrice(BaseModel):
    kind: Literal["shared"] = "shared"


VersionedPrice = Annotated[
    Annotated[CurrentOnlyPrice, Tag("current"), Version(up_to=CURRENT_VERSION)]
    | Annotated[SharedPrice, Tag("shared")],
    Discriminator(lambda v: v["kind"] if isinstance(v, dict) else v.kind),
]


class VersionedCatalog(BaseModel):
    prices: list[VersionedPrice]


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
    subscription = VersionedSubscription(
        product=VersionedProduct(
            name="Pro",
            shared_field="shared",
            current_field="current",
            next_field="next",
        )
    )

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
        current_schema = VersionedSubscription.model_json_schema(mode="serialization")
    current_product = current_schema["$defs"]["VersionedProduct"]
    assert set(current_product["properties"]) == {
        "name",
        "shared_field",
        "current_field",
    }
    assert set(current_product["required"]) == {"name", "shared_field", "current_field"}

    with api_version_context(NEXT_VERSION):
        next_schema = VersionedSubscription.model_json_schema(mode="serialization")
    next_product = next_schema["$defs"]["VersionedProduct"]
    assert set(next_product["properties"]) == {"name", "shared_field", "next_field"}
    assert (
        next_product["properties"]["next_field"]["description"]
        == "Only available in the next API version."
    )
    assert set(next_product["required"]) == {"name", "shared_field", "next_field"}


@pytest.mark.parametrize("api_version", [CURRENT_VERSION, NEXT_VERSION])
def test_versioned_computed_fields_are_required(api_version: APIVersion) -> None:
    next_version = Version(starting_from=NEXT_VERSION)

    class Model(BaseModel):
        @computed_field(exclude_if=next_version.exclude_if)
        def versioned(self) -> Annotated[int, next_version]:
            return 1

        @computed_field(exclude_if=lambda value: value is None)
        def conditional(self) -> int | None:
            return None

    with api_version_context(api_version):
        schema = Model.model_json_schema(mode="serialization")
        data = Model().model_dump()

    assert "conditional" in schema["properties"]
    assert "conditional" not in schema.get("required", [])
    assert "conditional" not in data
    if api_version == NEXT_VERSION:
        assert "versioned" in schema["properties"]
        assert schema["required"] == ["versioned"]
        assert data == {"versioned": 1}
    else:
        assert "versioned" not in schema["properties"]
        assert "versioned" not in schema.get("required", [])
        assert data == {}


@pytest.mark.parametrize(
    ("api_version", "included"), [(CURRENT_VERSION, False), (NEXT_VERSION, True)]
)
def test_prune_version_omitted_schemas(api_version: APIVersion, included: bool) -> None:
    app = FastAPI()

    @app.get("/order")
    def get_order() -> VersionedOrder:
        return VersionedOrder(discount=None)

    with api_version_context(api_version):
        schema = get_openapi(title="Test", version="1", routes=app.routes)
    schema = prune_version_omitted_schemas(schema, api_version)

    assert ("NextOnlyDiscount" in schema["components"]["schemas"]) is included


@pytest.mark.parametrize(
    ("api_version", "included"), [(CURRENT_VERSION, True), (NEXT_VERSION, False)]
)
def test_prune_version_omitted_output_only_schemas(
    api_version: APIVersion, included: bool
) -> None:
    app = FastAPI()

    @app.get("/order")
    def get_order() -> LegacyOrder:
        return LegacyOrder(coupon=None)

    with api_version_context(api_version):
        schema = get_openapi(title="Test", version="1", routes=app.routes)
    schema = prune_version_omitted_schemas(schema, api_version)

    assert ("OutputOnlyCoupon" in schema["components"]["schemas"]) is included


@pytest.mark.parametrize(
    ("api_version", "included"), [(CURRENT_VERSION, True), (NEXT_VERSION, False)]
)
def test_prune_version_omitted_union_members(
    api_version: APIVersion, included: bool
) -> None:
    app = FastAPI()

    @app.get("/catalog")
    def get_catalog() -> VersionedCatalog:
        return VersionedCatalog(prices=[SharedPrice()])

    with api_version_context(api_version):
        schema = get_openapi(title="Test", version="1", routes=app.routes)
    schema = prune_version_omitted_schemas(schema, api_version)

    schemas: dict[str, Any] = schema["components"]["schemas"]
    assert ("CurrentOnlyPrice" in schemas) is included
    assert "SharedPrice" in schemas
    members = schemas["VersionedCatalog"]["properties"]["prices"]["items"]["oneOf"]
    assert len(members) == (2 if included else 1)


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

    @router.get("/version-state")
    async def version_state(request: Request) -> dict[str, bool]:
        return {"api_version_set": request.scope["state"]["api_version_set"]}

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

    assert client.get("/version-state").json() == {"api_version_set": False}
    assert client.get(
        "/version-state", headers={"Polar-Version": "2026-04"}
    ).json() == {"api_version_set": True}

    assert client.get("/next-only").status_code == 404
    assert (
        client.get("/next-only", headers={"Polar-Version": "2026-10"}).status_code
        == 200
    )

    for api_version in (current_version, next_version):
        schema = get_openapi(
            title="Test",
            version=str(api_version),
            routes=routes_for_version(iter_route_contexts(app.routes), api_version),
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
