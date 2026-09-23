import re
from copy import copy
from dataclasses import replace
from itertools import product
from typing import Any

from fastapi.dependencies.models import Dependant
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute, RouteContext, iter_route_contexts

from polar.api import router
from polar.auth.dependencies import _Authenticator
from polar.kit.versioning import (
    APIVersion,
    api_version_context,
    finalize_versioned_routes,
    routes_for_version,
)
from polar.version import CURRENT_API_VERSION, VERSIONS

_OPENAPI_PATH = re.compile(r"\{([^}:]+):[^}]+\}")


def _openapi_path(path: str) -> str:
    return _OPENAPI_PATH.sub(r"{\1}", path)


def _scope_groups(dependant: Dependant) -> set[tuple[str, ...]]:
    groups = set()
    if isinstance(dependant.call, _Authenticator) and dependant.call.required_scopes:
        groups.add(
            tuple(sorted(str(scope) for scope in dependant.call.required_scopes))
        )
    for dependency in dependant.dependencies:
        groups.update(_scope_groups(dependency))
    return groups


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
    version_routes = routes_for_version(route_contexts, version)
    with api_version_context(version):
        schema = get_openapi(
            title="Void API",
            version=str(version),
            summary="Experimental Void API in Polar",
            routes=version_routes,
        )

    for context in version_routes:
        version_route = context.original_route
        if not isinstance(version_route, APIRoute):
            continue
        assert context.path is not None
        # FastAPI merges scopes; our authenticators accept any scope within each group.
        scope_groups = _scope_groups(version_route.dependant)
        for method in context.methods or ():
            operation = schema["paths"][_openapi_path(context.path)][method.lower()]
            operation["security"] = [
                {"oat": sorted(set(scopes))}
                for scopes in product(*sorted(scope_groups))
            ]
            operation.pop("x-speakeasy-ignore", None)
    oat_scheme = schema["components"]["securitySchemes"]["oat"]
    oat_scheme["description"] = (
        "An organization access token with Void scopes. For local development, "
        "use scripts.generate_void_token for a Void-enabled organization."
    )
    schema["components"]["securitySchemes"] = {"oat": oat_scheme}
    return schema
