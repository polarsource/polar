from collections.abc import Sequence
from enum import StrEnum
from typing import TYPE_CHECKING, Any, NotRequired, TypedDict

from fastapi.openapi.utils import get_openapi as _get_openapi
from fastapi.routing import RouteContext
from starlette.routing import BaseRoute

from polar.kit.metadata import add_metadata_query_schema
from polar.kit.versioning import api_version_context, prune_version_omitted_schemas
from polar.oauth2.schemas import add_oauth2_form_schemas

if TYPE_CHECKING:
    from polar.kit.versioning import APIVersion


class OpenAPIExternalDoc(TypedDict):
    description: NotRequired[str]
    url: str


class OpenAPITag(TypedDict):
    name: str
    description: NotRequired[str]
    externalDocs: NotRequired[dict[str, str]]


class APITag(StrEnum):
    """
    Tags used by our documentation to better organize the endpoints.

    They should be set after the "group" tag, which is used to group the endpoints
    in the generated documentation.

    **Example**

        ```py
        router = APIRouter(prefix="/products", tags=["products", APITag.public])
        ```
    """

    public = "public"
    private = "private"
    mcp = "mcp"
    cli = "cli"

    @classmethod
    def metadata(cls) -> list[OpenAPITag]:
        return [
            {
                "name": cls.public,
                "description": (
                    "Endpoints shown and documented in the Polar API documentation "
                    "and available in our SDKs."
                ),
            },
            {
                "name": cls.private,
                "description": (
                    "Endpoints that should appear in the schema only "
                    "in development to generate our internal JS SDK."
                ),
            },
            {
                "name": cls.mcp,
                "description": "Endpoints supported by Polar's MCP server.",
            },
            {
                "name": cls.cli,
                "description": "Endpoints exposed as commands by Polar's CLI.",
            },
        ]


def cli_preview(*fields: tuple[str, str]) -> dict[str, Any]:
    return {
        "x-polar-cli-preview": {
            "fields": [{"key": key, "label": label} for key, label in fields]
        }
    }


TOOL_ANNOTATIONS = "x-tool-annotations"
TOOL_DESTRUCTIVE = "x-tool-destructive"
TOOL_DESTRUCTIVE_WHEN = "x-tool-destructive-when"
TOOL_OPEN_WORLD = "x-tool-open-world"

type DestructiveValue = str | bool | int | float | None


def destructive() -> dict[str, Any]:
    """
    Mark an operation as destructive, whatever its input.

    `DELETE` operations already are, so this is only needed for other methods.
    """
    return {TOOL_DESTRUCTIVE: True}


def open_world() -> dict[str, Any]:
    """
    Mark an operation as reaching systems outside the organization, such as
    sending a request to a webhook URL or an email to a customer.
    """
    return {TOOL_OPEN_WORLD: True}


def destructive_when_equals(value: DestructiveValue) -> dict[str, Any]:
    """
    Mark the operation as destructive when this request field or parameter
    is set to `value`.
    """
    return {TOOL_DESTRUCTIVE_WHEN: {"equals": value}}


def destructive_when_one_of(*values: DestructiveValue) -> dict[str, Any]:
    """
    Mark the operation as destructive when this request field or parameter
    is set to one of `values`.
    """
    return {TOOL_DESTRUCTIVE_WHEN: {"one_of": list(values)}}


def _references_destructive_field(
    node: Any, schemas: dict[str, Any], visited: set[str]
) -> bool:
    if isinstance(node, list):
        return any(
            _references_destructive_field(item, schemas, visited) for item in node
        )
    if not isinstance(node, dict):
        return False
    if TOOL_DESTRUCTIVE_WHEN in node:
        return True

    reference = node.get("$ref")
    if isinstance(reference, str) and reference.startswith("#/components/schemas/"):
        name = reference.removeprefix("#/components/schemas/")
        if name not in visited:
            visited.add(name)
            if _references_destructive_field(schemas.get(name), schemas, visited):
                return True

    return any(
        _references_destructive_field(value, schemas, visited)
        for key, value in node.items()
        if key != "$ref"
    )


def add_destructive_tool_annotations(openapi_schema: dict[str, Any]) -> dict[str, Any]:
    """
    Add `destructive` to the `x-tool-annotations` of every MCP or CLI operation
    with a request field or parameter marked by `destructive_when_equals`
    or `destructive_when_one_of`.
    """
    schemas = openapi_schema.get("components", {}).get("schemas", {})
    for path_item in openapi_schema.get("paths", {}).values():
        for operation in path_item.values():
            if not isinstance(operation, dict):
                continue
            if not {APITag.mcp, APITag.cli} & set(operation.get("tags", [])):
                continue

            annotations: list[str] = operation.get(TOOL_ANNOTATIONS, [])
            if "destructive" in annotations:
                continue

            inputs = [operation.get("parameters", []), operation.get("requestBody")]
            if _references_destructive_field(inputs, schemas, set()):
                operation[TOOL_ANNOTATIONS] = ["destructive", *annotations]

    return openapi_schema


def get_openapi(
    version: "APIVersion",
    route_contexts: Sequence[RouteContext],
    webhooks: Sequence[BaseRoute],
) -> dict[str, Any]:
    with api_version_context(version):
        openapi_schema = _get_openapi(
            title="Polar API",
            version=str(version),
            summary="Polar HTTP and Webhooks API",
            description="Read the docs at https://polar.sh/docs/api-reference",
            routes=route_contexts,
            webhooks=webhooks,
            tags=APITag.metadata(),  # type: ignore
            servers=[
                {
                    "url": "https://api.polar.sh",
                    "description": "Production environment",
                    "x-speakeasy-server-id": "production",
                    "x-polar-environment": "production",
                },
                {
                    "url": "https://sandbox-api.polar.sh",
                    "description": "Sandbox environment",
                    "x-speakeasy-server-id": "sandbox",
                    "x-polar-environment": "sandbox",
                },
            ],
        )
    openapi_schema = add_metadata_query_schema(openapi_schema)
    openapi_schema = add_oauth2_form_schemas(openapi_schema)
    openapi_schema = prune_version_omitted_schemas(openapi_schema, version)
    openapi_schema = add_destructive_tool_annotations(openapi_schema)

    return openapi_schema


__all__ = [
    "APITag",
    "destructive",
    "destructive_when_equals",
    "destructive_when_one_of",
    "get_openapi",
]
