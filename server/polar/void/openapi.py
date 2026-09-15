from copy import copy
from dataclasses import replace
from typing import Any

from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute, RouteContext, iter_route_contexts

from polar.api import router
from polar.kit.versioning import (
    APIVersion,
    api_version_context,
    finalize_versioned_routes,
    routes_for_version,
)
from polar.version import CURRENT_API_VERSION, VERSIONS


def get_void_openapi(version: APIVersion = CURRENT_API_VERSION) -> dict[str, Any]:
    if version not in VERSIONS:
        raise ValueError(f"Unsupported API version: {version}")

    route_contexts = []
    for context in iter_route_contexts(router.routes):
        if not (context.path or "").startswith("/v1/void/"):
            continue
        if not isinstance(context.original_route, APIRoute):
            continue
        route = copy(context.original_route)
        route.include_in_schema = True
        effective_context = context._route_context
        if effective_context is not None:
            effective_context = replace(
                effective_context, original_route=route, include_in_schema=True
            )
        route_contexts.append(RouteContext(route, effective_context))

    finalize_versioned_routes(route_contexts, VERSIONS)
    with api_version_context(version):
        schema = get_openapi(
            title="Void API",
            version=str(version),
            summary="Experimental Void API in Polar",
            routes=routes_for_version(route_contexts, version),
        )

    for path in schema["paths"].values():
        for operation in path.values():
            if not isinstance(operation, dict) or "security" not in operation:
                continue
            scopes = {
                scope
                for requirement in operation["security"]
                for scope in requirement.get("oat", [])
            }
            operation["security"] = [{"oat": [scope]} for scope in sorted(scopes)]
            operation.pop("x-speakeasy-ignore", None)
    oat_scheme = schema["components"]["securitySchemes"]["oat"]
    oat_scheme["description"] = (
        "An organization access token with Void scopes. For local development, "
        "use scripts.generate_void_token for an allowlisted organization."
    )
    schema["components"]["securitySchemes"] = {"oat": oat_scheme}
    return schema
