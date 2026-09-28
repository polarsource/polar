from unittest.mock import MagicMock

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from starlette.types import ASGIApp, Receive, Scope, Send

from polar.observability.http_metrics import (
    METRICS_EXCLUDED_APPS,
    exclude_app_from_metrics,
)
from polar.observability.utils import get_path_template


class TestGetPathTemplate:
    @pytest.mark.parametrize(
        "scope",
        [
            pytest.param({"path": "/healthz", "type": "http"}, id="healthz"),
            pytest.param({"path": "/healthz/deep", "type": "http"}, id="denied_prefix"),
            pytest.param({"path": "/readyz", "type": "http"}, id="readyz"),
            pytest.param(
                {"path": "/.well-known/jwks.json", "type": "http"}, id="well_known"
            ),
            pytest.param({"path": "/v1/unknown", "type": "http"}, id="unknown_route"),
            pytest.param({"path": "", "type": "http"}, id="empty_path"),
            pytest.param({"type": "http"}, id="missing_path"),
        ],
    )
    def test_no_metrics(self, scope: Scope) -> None:
        assert get_path_template(scope) is None

    def test_middleware_uses_route_path(self) -> None:
        """Test that middleware uses route.path when available."""

        mock_route = MagicMock()
        mock_route.path = "/v1/checkouts/{id}"

        scope = {
            "path": "/v1/checkouts/550e8400-e29b-41d4-a716-446655440000",
            "route": mock_route,
            "type": "http",
        }

        result = get_path_template(scope)
        assert result == "/v1/checkouts/{id}"

    def test_nested_router_prefixes(self) -> None:
        checkouts_router = APIRouter(prefix="/checkouts")

        @checkouts_router.get("/{id}")
        async def get_checkout(id: str) -> None: ...

        v1_router = APIRouter(prefix="/v1")
        v1_router.include_router(checkouts_router)
        app = FastAPI()
        app.include_router(v1_router)

        templates: list[str | None] = []

        def capture_template(app: ASGIApp) -> ASGIApp:
            async def asgi(scope: Scope, receive: Receive, send: Send) -> None:
                await app(scope, receive, send)
                templates.append(get_path_template(scope))

            return asgi

        TestClient(capture_template(app)).get("/v1/checkouts/123")

        assert templates == ["/v1/checkouts/{id}"]

    def test_middleware_route_without_path_attr(self) -> None:
        """Test that unmatched routes return None (no metrics)."""

        # Route object without path attribute (or no route at all)
        mock_route = MagicMock(spec=[])  # Empty spec = no attributes

        scope = {
            "path": "/v1/orders/12345",
            "route": mock_route,
            "type": "http",
        }

        result = get_path_template(scope)
        # Should return None to skip metrics (prevents cardinality explosion)
        assert result is None

    def test_middleware_excludes_app(self) -> None:
        """Test that middleware excludes apps registered with exclude_app_from_metrics."""

        # Create a mock app
        mock_app = MagicMock()

        # Before excluding, scope with this app should not be denied
        mock_route = MagicMock()
        mock_route.path = "/some/path"

        scope = {
            "path": "/some/path",
            "type": "http",
            "app": mock_app,
            "route": mock_route,
        }
        result = get_path_template(scope)
        assert result == "/some/path"  # Should return the path

        # Register the app as excluded
        exclude_app_from_metrics(mock_app)

        try:
            # After excluding, scope with this app should return None
            result = get_path_template(scope)
            assert result is None  # Should be excluded
        finally:
            # Clean up to avoid affecting other tests
            METRICS_EXCLUDED_APPS.discard(mock_app)
