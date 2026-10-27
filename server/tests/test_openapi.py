import pathlib
from typing import Any, Literal

import pytest
from fastapi import APIRouter as _APIRouter
from fastapi import Query
from fastapi.openapi.utils import get_openapi
from httpx import AsyncClient
from openapi_kit.diff import compare
from openapi_kit.parser import OpenAPIParser
from pydantic import Field

from polar.kit.schemas import Schema
from polar.kit.versioning import APIVersion
from polar.openapi import (
    APITag,
    add_destructive_tool_annotations,
    destructive,
    destructive_when_equals,
    destructive_when_one_of,
    open_world,
)
from polar.routing import APIRouter
from polar.version import V2026_10, V2027_01, VERSIONS


@pytest.mark.anyio
@pytest.mark.parametrize("version", VERSIONS)
async def test_openapi(version: APIVersion, client: AsyncClient) -> None:
    response = await client.get(f"{version}/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert "Scope" in schema["components"]["schemas"]

    assert len(schema["webhooks"]) > 0
    assert schema["info"]["version"] == str(version)
    assert "subscription.migrated" in schema["webhooks"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    "version", [pytest.param(v, id=str(v)) for v in VERSIONS if v != V2027_01]
)
async def test_current_openapi_frozen(version: APIVersion, client: AsyncClient) -> None:
    OPENAPI_FROZEN_MESSAGE = """
    The current API contract is frozen and must not contain contract changes,
    including backward-compatible additions.

    To fix this:
    - Target NEXT_API_VERSION for intentional API changes using @version(...).
    - Revert accidental contract changes affecting the current version.
    - Do not update openapi.*.json files unless releasing a new API version.

    See handbook/engineering/design-documents/api-versioning.mdx.
    """.strip()

    response = await client.get(f"{version}/openapi.json")
    assert response.status_code == 200

    actual = OpenAPIParser.from_dict(response.json())
    expected_file = pathlib.Path(__file__).parent / f"openapi.{version}.json"
    if not expected_file.exists():
        pytest.fail(
            f"Missing expected OpenAPI file: {expected_file}. Run uv run -m scripts.generate_openapi generate {version} > tests/openapi.{version}.json"
        )
    expected = OpenAPIParser.from_source(expected_file)

    diff = compare(expected, actual)
    assert len(diff.operation_changes) == 0, OPENAPI_FROZEN_MESSAGE
    assert len(diff.schema_changes) == 0, OPENAPI_FROZEN_MESSAGE


DESTRUCTIVE_TOOL_OPERATIONS = {
    "benefits:update",
    "customers:members:update",
    "customers:members:update_external",
    "customers:update",
    "customers:update_external",
    "license_keys:rotate",
    "license_keys:update",
    "meters:update",
    "products:update",
    "products:update_benefits",
    "refunds:create",
    "subscriptions:update",
    "webhooks:reset_webhook_endpoint_secret",
    "webhooks:update_webhook_endpoint",
}

NON_DESTRUCTIVE_TOOL_OPERATIONS = {
    "benefits:create",
    "checkout-links:create",
    "checkout-links:update",
    "custom-fields:create",
    "custom-fields:update",
    "customer-seats:assign_seat",
    "customer-seats:claim_seat",
    "customer-seats:resend_invitation",
    "customers:create",
    "customers:members:create",
    "customers:members:create_external",
    "discounts:create",
    "discounts:update",
    "event-types:update",
    "meters:create",
    "orders:generate_invoice",
    "orders:update",
    "products:create",
    "webhooks:create_webhook_endpoint",
    "webhooks:redeliver_webhook_event",
}

DESTRUCTIVE_TOOL_OPERATIONS_SINCE: dict[str, APIVersion] = {
    "customer_meters:credits": V2027_01,
    "customer_meters:reverse_credit": V2027_01,
}


@pytest.mark.anyio
@pytest.mark.parametrize("version", VERSIONS)
async def test_tool_write_operations_are_classified(
    version: APIVersion, client: AsyncClient
) -> None:
    CLASSIFICATION_MESSAGE = """
    Every POST, PATCH and PUT operation exposed to the MCP server or the CLI must be
    classified, because `destructive` drives the CLI confirmation prompt and the MCP
    `destructiveHint`.

    To fix this, either:
    - mark the route with `openapi_extra=destructive()`, if it's always destructive;
    - mark the request fields that make it destructive with `destructive_when_equals()`
      or `destructive_when_one_of()` (see `polar/openapi.py`);
    - or add it to `NON_DESTRUCTIVE_TOOL_OPERATIONS` in this test.
    """.strip()

    response = await client.get(f"{version}/openapi.json")
    assert response.status_code == 200

    destructive: set[str] = set()
    non_destructive: set[str] = set()
    for path_item in response.json()["paths"].values():
        for method, operation in path_item.items():
            if method not in {"post", "patch", "put"}:
                continue
            if not {APITag.mcp, APITag.cli} & set(operation.get("tags", [])):
                continue
            if "destructive" in operation.get("x-tool-annotations", []):
                destructive.add(operation["operationId"])
            else:
                non_destructive.add(operation["operationId"])

    assert destructive == DESTRUCTIVE_TOOL_OPERATIONS | {
        operation_id
        for operation_id, since in DESTRUCTIVE_TOOL_OPERATIONS_SINCE.items()
        if version >= since
    }, CLASSIFICATION_MESSAGE
    assert non_destructive == NON_DESTRUCTIVE_TOOL_OPERATIONS, CLASSIFICATION_MESSAGE


class WidgetUpdate(Schema):
    is_archived: bool | None = Field(
        default=None, json_schema_extra=destructive_when_equals(True)
    )


class WidgetStatusUpdate(Schema):
    status: Literal["active", "disabled", "revoked"] | None = Field(
        default=None, json_schema_extra=destructive_when_one_of("disabled", "revoked")
    )


class WidgetRename(Schema):
    name: str


class WidgetCancel(Schema):
    cancel: bool = Field(json_schema_extra=destructive_when_equals(True))


class WidgetCreate(Schema):
    name: str


def get_tool_annotations(router: _APIRouter, method: str, path: str) -> list[str]:
    schema = add_destructive_tool_annotations(
        get_openapi(title="Widgets", version="1", routes=router.routes)
    )
    operation: dict[str, Any] = schema["paths"][path][method]
    return operation.get("x-tool-annotations", [])


class TestDestructiveToolAnnotations:
    def test_delete(self) -> None:
        router = APIRouter(
            prefix="/widgets", tags=["widgets", APITag.public, APITag.mcp]
        )

        @router.delete("/{id}")
        async def delete(id: str) -> None: ...

        assert get_tool_annotations(router, "delete", "/widgets/{id}") == [
            "destructive",
            "idempotent",
        ]

    def test_operation_marked_destructive(self) -> None:
        router = APIRouter(
            prefix="/widgets", tags=["widgets", APITag.public, APITag.cli]
        )

        @router.post("/{id}/rotate", openapi_extra=destructive())
        async def rotate(id: str) -> None: ...

        schema = get_openapi(title="Widgets", version="1", routes=router.routes)
        operation = schema["paths"]["/widgets/{id}/rotate"]["post"]
        assert operation["x-tool-annotations"] == ["destructive"]
        assert "x-tool-destructive" not in operation

    def test_operation_marked_open_world(self) -> None:
        router = APIRouter(
            prefix="/widgets", tags=["widgets", APITag.public, APITag.mcp]
        )

        @router.post("/{id}/notify", openapi_extra=open_world())
        async def notify(id: str) -> None: ...

        schema = get_openapi(title="Widgets", version="1", routes=router.routes)
        operation = schema["paths"]["/widgets/{id}/notify"]["post"]
        assert operation["x-tool-annotations"] == ["open_world"]
        assert "x-tool-open-world" not in operation

    def test_field_equals(self) -> None:
        router = APIRouter(
            prefix="/widgets", tags=["widgets", APITag.public, APITag.mcp]
        )

        @router.patch("/{id}")
        async def update(id: str, body: WidgetUpdate) -> None: ...

        assert get_tool_annotations(router, "patch", "/widgets/{id}") == ["destructive"]

    def test_field_one_of(self) -> None:
        router = APIRouter(
            prefix="/widgets", tags=["widgets", APITag.public, APITag.mcp]
        )

        @router.patch("/{id}")
        async def update(id: str, body: WidgetStatusUpdate) -> None: ...

        assert get_tool_annotations(router, "patch", "/widgets/{id}") == ["destructive"]

    def test_union_body_with_one_annotated_variant(self) -> None:
        router = APIRouter(
            prefix="/widgets", tags=["widgets", APITag.public, APITag.mcp]
        )

        @router.patch("/{id}")
        async def update(id: str, body: WidgetRename | WidgetCancel) -> None: ...

        assert get_tool_annotations(router, "patch", "/widgets/{id}") == ["destructive"]

    def test_parameter(self) -> None:
        router = APIRouter(
            prefix="/widgets", tags=["widgets", APITag.public, APITag.cli]
        )

        @router.post("/{id}/sync")
        async def sync(
            id: str,
            purge: bool = Query(
                default=False, json_schema_extra=destructive_when_equals(True)
            ),
        ) -> None: ...

        assert get_tool_annotations(router, "post", "/widgets/{id}/sync") == [
            "destructive"
        ]

    def test_plain_post(self) -> None:
        router = APIRouter(
            prefix="/widgets", tags=["widgets", APITag.public, APITag.mcp]
        )

        @router.post("/")
        async def create(body: WidgetCreate) -> None: ...

        assert get_tool_annotations(router, "post", "/widgets/") == []

    def test_explicit_override(self) -> None:
        router = APIRouter(
            prefix="/widgets", tags=["widgets", APITag.public, APITag.mcp]
        )

        @router.delete("/{id}", openapi_extra={"x-tool-annotations": ["idempotent"]})
        async def delete(id: str) -> None: ...

        @router.patch("/{id}", openapi_extra={"x-tool-annotations": ["idempotent"]})
        async def update(id: str, body: WidgetUpdate) -> None: ...

        assert get_tool_annotations(router, "delete", "/widgets/{id}") == ["idempotent"]
        assert get_tool_annotations(router, "patch", "/widgets/{id}") == [
            "destructive",
            "idempotent",
        ]

    def test_without_the_mcp_or_cli_tags(self) -> None:
        router = APIRouter(prefix="/widgets", tags=["widgets", APITag.public])

        @router.patch("/{id}")
        async def update(id: str, body: WidgetUpdate) -> None: ...

        assert get_tool_annotations(router, "patch", "/widgets/{id}") == []


@pytest.mark.anyio
@pytest.mark.parametrize(("version", "included"), [(V2026_10, True), (V2027_01, False)])
async def test_legacy_recurring_product_price_schema(
    version: APIVersion, included: bool, client: AsyncClient
) -> None:
    response = await client.get(f"{version}/openapi.json")
    assert response.status_code == 200

    schemas = response.json()["components"]["schemas"]
    assert ("LegacyRecurringProductPrice" in schemas) is included
