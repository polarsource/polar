from typing import Annotated, Any

from fastapi import APIRouter as _APIRouter
from fastapi import Depends
from fastapi.routing import APIRoute

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.models import Organization
from polar.openapi import APITag
from polar.routing import APIRouter

_Auth = Annotated[
    AuthSubject[Organization],
    Depends(
        Authenticator(
            allowed_subjects={Organization}, required_scopes={Scope.products_write}
        )
    ),
]


def get_openapi_extra(router: _APIRouter, name: str) -> dict[str, Any]:
    return get_route(router, name).openapi_extra or {}


def get_route(router: _APIRouter, name: str) -> APIRoute:
    for route in router.routes:
        if isinstance(route, APIRoute) and route.name == name:
            return route
    raise LookupError(name)


def test_tool_properties_are_derived_from_the_route() -> None:
    router = APIRouter(prefix="/custom-fields", tags=["custom-fields", APITag.mcp])

    @router.get("/", summary="List Custom Fields")
    async def list() -> None:
        """List custom fields."""

    @router.delete("/{id}", summary="Delete Custom Field")
    async def delete() -> None:
        """Delete a custom field."""

    assert get_openapi_extra(router, "list") == {
        "x-tool-name": "custom_fields_list",
        "x-tool-title": "List Custom Fields",
        "x-tool-description": "List custom fields.",
        "x-tool-annotations": ["read_only", "idempotent"],
        "x-speakeasy-ignore": True,
        "x-speakeasy-name-override": "list",
        "x-speakeasy-group": "custom-fields",
    }
    assert get_openapi_extra(router, "delete")["x-tool-annotations"] == [
        "destructive",
        "idempotent",
    ]


def test_tool_description_excludes_the_documented_scopes() -> None:
    router = APIRouter(prefix="/products", tags=["products", APITag.mcp])

    @router.post("/")
    async def create(auth_subject: _Auth) -> None:
        """Create a product."""

    route = get_route(router, "create")
    openapi_extra = route.openapi_extra or {}

    assert openapi_extra["x-tool-description"] == "Create a product."
    assert "**Scopes**" in (route.description or "")
    assert "x-tool-annotations" not in openapi_extra


def test_tool_properties_can_be_overridden() -> None:
    router = APIRouter(prefix="/meters", tags=["meters", APITag.mcp])

    @router.get(
        "/",
        summary="List Meters",
        openapi_extra={"x-tool-description": "List all usage meters."},
    )
    async def list() -> None:
        """List meters."""

    openapi_extra = get_openapi_extra(router, "list")

    assert openapi_extra["x-tool-description"] == "List all usage meters."
    assert openapi_extra["x-tool-title"] == "List Meters"


def test_tool_properties_are_skipped_without_the_mcp_tag() -> None:
    router = APIRouter(prefix="/refunds", tags=["refunds", APITag.public])

    @router.get("/", summary="List Refunds")
    async def list() -> None:
        """List refunds."""

    assert "x-tool-name" not in get_openapi_extra(router, "list")
