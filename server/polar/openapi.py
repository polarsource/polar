from enum import StrEnum
from typing import Any, NotRequired, TypedDict

from polar.config import settings


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
        router = APIRouter(prefix="/products", tags=["products", APITag.featured])
        ```
    """

    documented = "documented"
    featured = "featured"
    issue_funding = "issue_funding"

    @classmethod
    def metadata(cls) -> list[OpenAPITag]:
        return [
            {
                "name": cls.documented,
                "description": (
                    "Endpoints shown and documented in the Polar API documentation."
                ),
            },
            {
                "name": cls.featured,
                "description": (
                    "Endpoints featured in the Polar API documentation "
                    "for their interest in common use-cases."
                ),
            },
            {
                "name": cls.issue_funding,
                "description": (
                    "Endpoints related to issue funding and rewards in the Polar API."
                ),
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
    "description": "Read the docs at https://docs.polar.sh/api",
    "docs_url": None if settings.is_production() else "/docs",
    "redoc_url": None if settings.is_production() else "/redoc",
    "openapi_tags": APITag.metadata(),  # type: ignore
    "servers": [{"url": "https://api.polar.sh"}],
}

IN_DEVELOPMENT_ONLY = settings.is_development()

__all__ = ["OPENAPI_PARAMETERS", "IN_DEVELOPMENT_ONLY", "APITag"]
