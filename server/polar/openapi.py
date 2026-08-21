from collections.abc import Sequence
from enum import StrEnum
from typing import TYPE_CHECKING, Any, NotRequired, TypedDict

from fastapi.openapi.utils import get_openapi as _get_openapi
from starlette.routing import BaseRoute

from polar.kit.metadata import add_metadata_query_schema
from polar.kit.versioning import api_version_context
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
        ]


def get_openapi(
    version: "APIVersion", routes: Sequence[BaseRoute], webhooks: Sequence[BaseRoute]
) -> dict[str, Any]:
    with api_version_context(version):
        openapi_schema = _get_openapi(
            title="Polar API",
            version=str(version),
            summary="Polar HTTP and Webhooks API",
            description="Read the docs at https://polar.sh/docs/api-reference",
            routes=routes,
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

    return openapi_schema


__all__ = [
    "APITag",
    "get_openapi",
]
