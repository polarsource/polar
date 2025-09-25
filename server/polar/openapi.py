from enum import StrEnum
from typing import Any, NotRequired, TypedDict

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from polar.config import Environment, settings
from polar.kit.metadata import add_metadata_query_schema
from polar.oauth2.schemas import add_oauth2_form_schemas


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
                "description": "Endpoints enabled in the MCP server.",
            },
        ]


class OpenAPIParameters(TypedDict):
    title: str
    summary: str
    version: str
    description: str
    docs_url: str | None
    redoc_url: str | None
    openapi_tags: list[dict[str, Any]]
    servers: list[dict[str, Any]] | None


OPENAPI_PARAMETERS: OpenAPIParameters = {
    "title": "Polar API",
    "summary": "Polar HTTP and Webhooks API",
    "version": "0.1.0",
    "description": "Read the docs at https://polar.sh/docs/api-reference",
    "docs_url": None
    if settings.is_environment({Environment.sandbox, Environment.production})
    else "/docs",
    "redoc_url": None
    if settings.is_environment({Environment.sandbox, Environment.production})
    else "/redoc",
    "openapi_tags": APITag.metadata(),  # type: ignore
    "servers": [
        {
            "url": "https://api.polar.sh",
            "description": "Production environment",
            "x-speakeasy-server-id": "production",
        },
        {
            "url": "https://sandbox-api.polar.sh",
            "description": "Sandbox environment",
            "x-speakeasy-server-id": "sandbox",
        },
    ],
}


def set_openapi_generator(app: FastAPI) -> None:
    def _openapi_generator() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema

        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            openapi_version=app.openapi_version,
            summary=app.summary,
            description=app.description,
            terms_of_service=app.terms_of_service,
            contact=app.contact,
            license_info=app.license_info,
            routes=app.routes,
            webhooks=app.webhooks.routes,
            tags=app.openapi_tags,
            servers=app.servers,
            separate_input_output_schemas=app.separate_input_output_schemas,
        )

        openapi_schema = add_metadata_query_schema(openapi_schema)
        openapi_schema = add_oauth2_form_schemas(openapi_schema)

        return openapi_schema

    app.openapi = _openapi_generator  # type: ignore[method-assign]


__all__ = [
    "OPENAPI_PARAMETERS",
    "APITag",
    "set_openapi_generator",
]
