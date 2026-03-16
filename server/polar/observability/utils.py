from starlette.types import Scope

from .http_metrics import METRICS_DENY_LIST, METRICS_EXCLUDED_APPS


def get_path_template(scope: Scope) -> str | None:
    """
    Get the normalized path template for metrics labeling.

    Primary: Uses scope["route"].path set by FastAPI after routing.
    Fallback: Regex normalization for 404s/unmatched routes.

    Returns None for deny-listed paths or excluded apps (no metrics recorded).
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

    # Primary: Use FastAPI's route object (most reliable)
    # This is populated after routing completes, which is why we
    # call this in the finally block after the request
    route = scope.get("route")
    if route and hasattr(route, "path"):
        return route.path  # e.g., "/v1/checkouts/{id}"

    # No route matched (404 on unknown path) - skip metrics
    # to prevent cardinality explosion from bots/attackers
    return None
