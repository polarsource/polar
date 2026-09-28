from fastapi.routing import _get_scope_effective_route_context
from starlette.types import Scope

from .http_metrics import METRICS_DENY_LIST, METRICS_EXCLUDED_APPS


def get_path_template(scope: Scope) -> str | None:
    """
    Get the normalized path template for metrics labeling.

    Uses the full route path template, set by FastAPI after routing.

    Returns None — no metrics recorded — for excluded apps, deny-listed paths,
    and requests that matched no route.
    """
    # Check if app is excluded (e.g., backoffice)
    app = scope.get("app")
    if app is not None and app in METRICS_EXCLUDED_APPS:
        return None

    path = scope.get("path", "")

    # Check deny list (exact match and prefix)
    if path in METRICS_DENY_LIST:
        return None
    for denied in METRICS_DENY_LIST:
        if path.startswith(denied):
            return None

    # Populated after routing completes, which is why we
    # call this in the finally block after the request.
    # Since FastAPI 0.141, scope["route"] is the route as declared on its own
    # router, without the prefixes of the routers including it. Routes declared
    # directly on the app have no effective context and keep scope["route"].
    route_context = _get_scope_effective_route_context(scope)
    route_path = getattr(route_context, "path", None) or getattr(
        scope.get("route"), "path", None
    )
    if isinstance(route_path, str):
        return route_path  # e.g., "/v1/checkouts/{id}"

    # No route matched (404 on unknown path) - skip metrics
    # to prevent cardinality explosion from bots/attackers
    return None
