from collections.abc import Iterator

from fastapi.dependencies.models import Dependant
from fastapi.routing import iter_route_contexts

from polar.app import app
from polar.auth.dependencies import _Authenticator
from polar.auth.models import Agent

# Every route an unclaimed agent can call, as "METHOD /path".
AGENT_ROUTES: set[str] = set()


def _authenticators(dependant: Dependant) -> Iterator[_Authenticator]:
    for dependency in dependant.dependencies:
        if isinstance(dependency.call, _Authenticator):
            yield dependency.call
        yield from _authenticators(dependency)


def _agent_routes() -> set[str]:
    routes: set[str] = set()
    for route in iter_route_contexts(app.routes):
        dependant: Dependant | None = getattr(route, "dependant", None) or getattr(
            route.original_route, "dependant", None
        )
        if dependant is None:
            continue
        if any(Agent in a.allowed_subjects for a in _authenticators(dependant)):
            for method in route.methods or {"WEBSOCKET"}:
                routes.add(f"{method} {route.path}")
    return routes


def test_agent_routes() -> None:
    AGENT_ROUTES_MESSAGE = """
    The routes that accept the `Agent` subject changed. An unclaimed agent may
    only reach the catalog setup endpoints listed in ADR-0014, so every route
    that lists `Agent` in its `Authenticator`'s `allowed_subjects` is pinned here.

    If you opened a route to agents on purpose, add it to `AGENT_ROUTES` in this
    test so it shows up in review. Otherwise, remove `Agent` from that route's
    `allowed_subjects`.
    """.strip()

    assert _agent_routes() == AGENT_ROUTES, AGENT_ROUTES_MESSAGE
