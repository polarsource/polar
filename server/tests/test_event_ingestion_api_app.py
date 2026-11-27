from fastapi.routing import iter_route_contexts

from polar.event_ingestion_api_app import app


def test_serves_only_event_ingestion_and_health_check() -> None:
    routes = {
        (method, context.path)
        for context in iter_route_contexts(app.router.routes)
        if context.path is not None
        for method in context.methods or ()
    }

    assert {route for route in routes if route[1].startswith("/v1/")} == {
        ("POST", "/v1/events/ingest")
    }
    assert ("GET", "/healthz") in routes
