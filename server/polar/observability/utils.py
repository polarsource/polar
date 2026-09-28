from starlette.types import Scope

from .http_metrics import METRICS_DENY_LIST, METRICS_EXCLUDED_APPS
from .http_telemetry import route_path_template


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
    # None when no route matched (404 on unknown path) - skip metrics
    # to prevent cardinality explosion from bots/attackers
    return route_path_template(scope)  # e.g., "/v1/checkouts/{id}"
