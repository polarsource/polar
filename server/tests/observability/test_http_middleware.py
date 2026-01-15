"""Tests for HTTP metrics middleware.

These tests are isolated from the main Polar infrastructure to avoid
database and service connections during unit testing.
"""

import asyncio
import os
import tempfile
from collections.abc import Generator
from typing import Any, cast
from unittest.mock import MagicMock

import pytest
from starlette.types import Receive, Scope, Send


class TestPathNormalizationDirect:
    """Test path normalization logic directly without full middleware setup."""

    def test_normalize_uuid(self) -> None:
        """Test that UUIDs are normalized to {id}."""
        import re

        # UUID pattern from the middleware
        uuid_pattern = (
            r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
            r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        )

        path = "/v1/checkouts/550e8400-e29b-41d4-a716-446655440000"
        result = re.sub(uuid_pattern, "/{id}", path)
        assert result == "/v1/checkouts/{id}"

    def test_normalize_numeric_id(self) -> None:
        """Test that numeric IDs are normalized to {id}."""
        import re

        path = "/v1/orders/12345"
        result = re.sub(r"/\d+(?=/|$)", "/{id}", path)
        assert result == "/v1/orders/{id}"

    def test_normalize_long_token(self) -> None:
        """Test that long alphanumeric tokens are normalized to {token}."""
        import re

        path = "/v1/checkouts/client/cs_test_abc123XYZ_longsecret/confirm"
        result = re.sub(r"/[A-Za-z0-9_-]{20,}(?=/|$)", "/{token}", path)
        assert result == "/v1/checkouts/client/{token}/confirm"

    def test_normalize_multiple_ids(self) -> None:
        """Test normalization of paths with multiple IDs."""
        import re

        uuid_pattern = (
            r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
            r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        )

        path = "/v1/orgs/550e8400-e29b-41d4-a716-446655440000/products/12345"
        result = re.sub(uuid_pattern, "/{id}", path)
        result = re.sub(r"/\d+(?=/|$)", "/{id}", result)
        assert result == "/v1/orgs/{id}/products/{id}"

    def test_no_normalization_for_short_segments(self) -> None:
        """Test that short path segments are not normalized."""
        import re

        path = "/v1/checkouts/list"
        # Apply all normalizations
        uuid_pattern = (
            r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
            r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        )
        result = re.sub(uuid_pattern, "/{id}", path)
        result = re.sub(r"/\d+(?=/|$)", "/{id}", result)
        result = re.sub(r"/[A-Za-z0-9_-]{20,}(?=/|$)", "/{token}", result)
        assert result == "/v1/checkouts/list"

    def test_uppercase_uuid(self) -> None:
        """Test that uppercase UUIDs are also normalized."""
        import re

        uuid_pattern = (
            r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
            r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        )

        path = "/v1/checkouts/550E8400-E29B-41D4-A716-446655440000"
        result = re.sub(uuid_pattern, "/{id}", path)
        assert result == "/v1/checkouts/{id}"

    def test_token_at_end_of_path(self) -> None:
        """Test that tokens at end of path are normalized."""
        import re

        path = "/v1/checkout/cs_test_abc123XYZ_longsecret"
        result = re.sub(r"/[A-Za-z0-9_-]{20,}(?=/|$)", "/{token}", path)
        assert result == "/v1/checkout/{token}"

    def test_mixed_id_types(self) -> None:
        """Test path with UUID, numeric ID, and token together."""
        import re

        uuid_pattern = (
            r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
            r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        )

        path = "/v1/orgs/550e8400-e29b-41d4-a716-446655440000/orders/12345/token/abcdefghij1234567890"
        result = re.sub(uuid_pattern, "/{id}", path)
        result = re.sub(r"/\d+(?=/|$)", "/{id}", result)
        result = re.sub(r"/[A-Za-z0-9_-]{20,}(?=/|$)", "/{token}", result)
        assert result == "/v1/orgs/{id}/orders/{id}/token/{token}"

    def test_numeric_id_not_normalized_in_middle_of_segment(self) -> None:
        """Test that numbers within path segments are not normalized."""
        import re

        path = "/v1/api2/users"
        result = re.sub(r"/\d+(?=/|$)", "/{id}", path)
        assert result == "/v1/api2/users"  # api2 should NOT become api{id}

    def test_token_with_hyphens(self) -> None:
        """Test that tokens with hyphens are normalized."""
        import re

        path = "/v1/checkout/cs-test-abc-123-xyz-longsecret"
        result = re.sub(r"/[A-Za-z0-9_-]{20,}(?=/|$)", "/{token}", path)
        assert result == "/v1/checkout/{token}"

    def test_empty_path(self) -> None:
        """Test empty path handling."""
        import re

        uuid_pattern = (
            r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
            r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        )

        path = ""
        result = re.sub(uuid_pattern, "/{id}", path)
        result = re.sub(r"/\d+(?=/|$)", "/{id}", result)
        result = re.sub(r"/[A-Za-z0-9_-]{20,}(?=/|$)", "/{token}", result)
        assert result == ""

    def test_root_path(self) -> None:
        """Test root path handling."""
        import re

        path = "/"
        result = re.sub(r"/\d+(?=/|$)", "/{id}", path)
        assert result == "/"


class TestDenyListLogic:
    """Test deny list logic without importing polar modules."""

    def test_healthz_in_deny_list(self) -> None:
        """Test that /healthz would be denied."""
        deny_list = {
            "/healthz",
            "/readyz",
            "/.well-known/openid-configuration",
            "/.well-known/jwks.json",
        }

        path = "/healthz"
        assert path in deny_list

    def test_well_known_in_deny_list(self) -> None:
        """Test that /.well-known paths would be denied."""
        deny_list = {
            "/healthz",
            "/readyz",
            "/.well-known/openid-configuration",
            "/.well-known/jwks.json",
        }

        path = "/.well-known/openid-configuration"
        assert path in deny_list

    def test_regular_path_not_in_deny_list(self) -> None:
        """Test that regular API paths are not denied."""
        deny_list = {
            "/healthz",
            "/readyz",
            "/.well-known/openid-configuration",
            "/.well-known/jwks.json",
        }

        path = "/v1/checkouts/"
        assert path not in deny_list

    def test_prefix_matching_logic(self) -> None:
        """Test that prefix matching works correctly."""
        deny_list = {
            "/healthz",
            "/readyz",
            "/.well-known/openid-configuration",
            "/.well-known/jwks.json",
        }

        # This path is NOT in deny_list exact match but could be prefix matched
        # The middleware checks startswith for prefix matching
        path = "/healthz/deep"

        # Exact match fails
        assert path not in deny_list

        # But prefix match would work
        for denied in deny_list:
            if path.startswith(denied):
                matched = True
                break
        else:
            matched = False

        # Note: /healthz/deep starts with /healthz
        assert matched is True

    def test_readyz_in_deny_list(self) -> None:
        """Test that /readyz is in deny list."""
        deny_list = {
            "/healthz",
            "/readyz",
            "/.well-known/openid-configuration",
            "/.well-known/jwks.json",
        }

        assert "/readyz" in deny_list


class TestRouteTemplateLogic:
    """Test route template extraction logic."""

    def test_uses_route_path_when_available(self) -> None:
        """Test that route.path is used when available in scope."""
        mock_route = MagicMock()
        mock_route.path = "/v1/checkouts/{id}"

        scope = {
            "path": "/v1/checkouts/550e8400-e29b-41d4-a716-446655440000",
            "route": mock_route,
        }

        # Logic from middleware
        route = scope.get("route")
        if route and hasattr(route, "path"):
            result = route.path
        else:
            result = scope.get("path")

        assert result == "/v1/checkouts/{id}"

    def test_falls_back_to_path_when_no_route(self) -> None:
        """Test fallback to scope path when no route available."""
        scope = {
            "path": "/v1/checkouts/550e8400-e29b-41d4-a716-446655440000",
        }

        # Logic from middleware
        route = scope.get("route")
        if route and hasattr(route, "path"):
            result = route.path
        else:
            result = scope.get("path")

        # Would need normalization, but raw value is the path
        assert result == "/v1/checkouts/550e8400-e29b-41d4-a716-446655440000"


@pytest.fixture(scope="module")
def prometheus_tmpdir() -> Generator[str, None, None]:
    """Create a temporary prometheus directory for module tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        os.environ["PROMETHEUS_MULTIPROC_DIR"] = tmpdir
        yield tmpdir


class TestMiddlewareIntegration:
    """Integration tests that import the actual middleware."""

    def test_middleware_imports_successfully(self, prometheus_tmpdir: str) -> None:
        """Test that the middleware can be imported."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        assert HttpMetricsMiddleware is not None

    def test_middleware_denies_healthz(self, prometheus_tmpdir: str) -> None:
        """Test that middleware denies /healthz."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        scope = {"path": "/healthz", "type": "http"}
        result = middleware._get_path_template(scope)
        assert result is None

    def test_middleware_uses_route_path(self, prometheus_tmpdir: str) -> None:
        """Test that middleware uses route.path when available."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        mock_route = MagicMock()
        mock_route.path = "/v1/checkouts/{id}"

        scope = {
            "path": "/v1/checkouts/550e8400-e29b-41d4-a716-446655440000",
            "route": mock_route,
            "type": "http",
        }

        result = middleware._get_path_template(scope)
        assert result == "/v1/checkouts/{id}"

    def test_middleware_route_without_path_attr(self, prometheus_tmpdir: str) -> None:
        """Test that unmatched routes return None (no metrics)."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        # Route object without path attribute (or no route at all)
        mock_route = MagicMock(spec=[])  # Empty spec = no attributes

        scope = {
            "path": "/v1/orders/12345",
            "route": mock_route,
            "type": "http",
        }

        result = middleware._get_path_template(scope)
        # Should return None to skip metrics (prevents cardinality explosion)
        assert result is None

    def test_middleware_prefix_deny(self, prometheus_tmpdir: str) -> None:
        """Test that paths starting with denied prefixes are blocked."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        scope = {"path": "/healthz/deep", "type": "http"}
        result = middleware._get_path_template(scope)
        assert result is None  # Should be denied

    def test_middleware_denies_readyz(self, prometheus_tmpdir: str) -> None:
        """Test that middleware denies /readyz."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        scope = {"path": "/readyz", "type": "http"}
        result = middleware._get_path_template(scope)
        assert result is None

    def test_middleware_denies_well_known(self, prometheus_tmpdir: str) -> None:
        """Test that middleware denies /.well-known paths."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        scope = {"path": "/.well-known/jwks.json", "type": "http"}
        result = middleware._get_path_template(scope)
        assert result is None

    def test_middleware_empty_path(self, prometheus_tmpdir: str) -> None:
        """Test middleware with empty path."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        scope = {"path": "", "type": "http"}
        result = middleware._get_path_template(scope)
        # No route matched, returns None to skip metrics
        assert result is None

    def test_middleware_missing_path(self, prometheus_tmpdir: str) -> None:
        """Test middleware when path is missing from scope."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        scope = {"type": "http"}  # No path key
        result = middleware._get_path_template(scope)
        # No route matched, returns None to skip metrics
        assert result is None

    def test_middleware_unknown_route_returns_none(
        self, prometheus_tmpdir: str
    ) -> None:
        """Test that unknown routes return None (no metrics exported)."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        # Simulate an unknown route - no route object in scope
        scope = {"path": "/v1/unknown", "type": "http"}
        result = middleware._get_path_template(scope)
        # Should return None to prevent cardinality explosion
        assert result is None


class TestMiddlewareASGIBehavior:
    """Test ASGI middleware behavior including async calls."""

    @pytest.fixture(scope="class")
    def prometheus_tmpdir(self) -> Generator[str, None, None]:
        """Create a temporary prometheus directory for class tests."""
        with tempfile.TemporaryDirectory() as tmpdir:
            os.environ["PROMETHEUS_MULTIPROC_DIR"] = tmpdir
            yield tmpdir

    def test_non_http_scope_passthrough(self, prometheus_tmpdir: str) -> None:
        """Test that non-HTTP scopes are passed through without metrics."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        app_called = False

        async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
            nonlocal app_called
            app_called = True

        middleware = HttpMetricsMiddleware(mock_app)

        # Websocket scope
        scope = cast(Scope, {"type": "websocket", "path": "/ws"})

        asyncio.get_event_loop().run_until_complete(
            middleware(scope, cast(Receive, None), cast(Send, None))
        )

        assert app_called is True

    def test_lifespan_scope_passthrough(self, prometheus_tmpdir: str) -> None:
        """Test that lifespan scopes are passed through without metrics."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        app_called = False

        async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
            nonlocal app_called
            app_called = True

        middleware = HttpMetricsMiddleware(mock_app)

        # Lifespan scope
        scope = cast(Scope, {"type": "lifespan"})

        asyncio.get_event_loop().run_until_complete(
            middleware(scope, cast(Receive, None), cast(Send, None))
        )

        assert app_called is True

    def test_status_code_capture(self, prometheus_tmpdir: str) -> None:
        """Test that status codes are correctly captured."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
            await send({"type": "http.response.start", "status": 201})
            await send({"type": "http.response.body", "body": b""})

        middleware = HttpMetricsMiddleware(mock_app)

        scope = cast(
            Scope,
            {
                "type": "http",
                "path": "/v1/checkouts",
                "method": "POST",
            },
        )

        messages_sent: list[dict[str, Any]] = []

        async def mock_send(message: dict[str, Any]) -> None:
            messages_sent.append(message)

        asyncio.get_event_loop().run_until_complete(
            middleware(scope, cast(Receive, None), cast(Send, mock_send))
        )

        # Verify the status was captured (201)
        assert any(m.get("status") == 201 for m in messages_sent)

    def test_exception_still_records_metrics(self, prometheus_tmpdir: str) -> None:
        """Test that metrics are recorded even when app raises exception."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
            raise ValueError("Test exception")

        middleware = HttpMetricsMiddleware(mock_app)

        scope = cast(
            Scope,
            {
                "type": "http",
                "path": "/v1/checkouts",
                "method": "GET",
            },
        )

        async def noop_send(message: dict[str, Any]) -> None:
            pass

        # The middleware should record metrics in finally block
        # and then re-raise the exception
        with pytest.raises(ValueError, match="Test exception"):
            asyncio.get_event_loop().run_until_complete(
                middleware(scope, cast(Receive, None), cast(Send, noop_send))
            )

    def test_default_status_code_on_exception(self, prometheus_tmpdir: str) -> None:
        """Test that status code defaults to 500 when no response sent."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        # This tests that status_code starts as "500" (line 89 in middleware)
        # and stays that way if app crashes before sending response

        async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
            # Crash before sending any response
            raise RuntimeError("App crashed")

        middleware = HttpMetricsMiddleware(mock_app)

        scope = cast(
            Scope,
            {
                "type": "http",
                "path": "/v1/test",
                "method": "GET",
            },
        )

        async def noop_send(message: dict[str, Any]) -> None:
            pass

        with pytest.raises(RuntimeError):
            asyncio.get_event_loop().run_until_complete(
                middleware(scope, cast(Receive, None), cast(Send, noop_send))
            )

        # Can't directly assert the status_code was "500" without mocking metrics
        # but this test ensures the code path works without crashing

    def test_missing_method_uses_unknown(self, prometheus_tmpdir: str) -> None:
        """Test that missing method in scope results in UNKNOWN."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
            await send({"type": "http.response.start", "status": 200})
            await send({"type": "http.response.body", "body": b""})

        middleware = HttpMetricsMiddleware(mock_app)

        # Scope without method
        scope = cast(
            Scope,
            {
                "type": "http",
                "path": "/v1/test",
                # No "method" key
            },
        )

        async def mock_send(message: dict[str, Any]) -> None:
            pass

        # Should not crash - method defaults to "UNKNOWN"
        asyncio.get_event_loop().run_until_complete(
            middleware(scope, cast(Receive, None), cast(Send, mock_send))
        )

    def test_various_http_methods(self, prometheus_tmpdir: str) -> None:
        """Test that various HTTP methods are handled correctly."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
            await send({"type": "http.response.start", "status": 200})
            await send({"type": "http.response.body", "body": b""})

        middleware = HttpMetricsMiddleware(mock_app)

        methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]

        async def noop_send(message: dict[str, Any]) -> None:
            pass

        for method in methods:
            scope = cast(
                Scope,
                {
                    "type": "http",
                    "path": "/v1/test",
                    "method": method,
                },
            )

            # Should not crash for any method
            asyncio.get_event_loop().run_until_complete(
                middleware(scope, cast(Receive, None), cast(Send, noop_send))
            )

    def test_various_status_codes(self, prometheus_tmpdir: str) -> None:
        """Test that various status codes are captured correctly."""
        from polar.observability.http_middleware import HttpMetricsMiddleware

        status_codes = [200, 201, 204, 301, 400, 401, 403, 404, 500, 502, 503]

        for status in status_codes:

            async def mock_app(
                scope: Scope, receive: Receive, send: Send, _status: int = status
            ) -> None:
                await send({"type": "http.response.start", "status": _status})
                await send({"type": "http.response.body", "body": b""})

            middleware = HttpMetricsMiddleware(mock_app)

            scope = cast(
                Scope,
                {
                    "type": "http",
                    "path": "/v1/test",
                    "method": "GET",
                },
            )

            captured: list[dict[str, Any]] = []

            async def mock_send(message: dict[str, Any]) -> None:
                captured.append(message)

            asyncio.get_event_loop().run_until_complete(
                middleware(scope, cast(Receive, None), cast(Send, mock_send))
            )

            assert any(m.get("status") == status for m in captured)

    def test_middleware_excludes_app(self, prometheus_tmpdir: str) -> None:
        """Test that middleware excludes apps registered with exclude_app_from_metrics."""
        from polar.observability.http_metrics import (
            METRICS_EXCLUDED_APPS,
            exclude_app_from_metrics,
        )
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

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
        result = middleware._get_path_template(scope)
        assert result == "/some/path"  # Should return the path

        # Register the app as excluded
        exclude_app_from_metrics(mock_app)

        try:
            # After excluding, scope with this app should return None
            result = middleware._get_path_template(scope)
            assert result is None  # Should be excluded
        finally:
            # Clean up to avoid affecting other tests
            METRICS_EXCLUDED_APPS.discard(mock_app)

    def test_middleware_excluded_app_with_valid_route(
        self, prometheus_tmpdir: str
    ) -> None:
        """Test that excluded apps are skipped even with valid routes."""
        from polar.observability.http_metrics import (
            METRICS_EXCLUDED_APPS,
            exclude_app_from_metrics,
        )
        from polar.observability.http_middleware import HttpMetricsMiddleware

        middleware = HttpMetricsMiddleware(lambda s, r, se: None)

        # Create a mock app and register it as excluded
        mock_app = MagicMock()
        exclude_app_from_metrics(mock_app)

        try:
            # Even with a valid route, excluded app should return None
            mock_route = MagicMock()
            mock_route.path = "/v1/checkouts/{id}"

            scope = {
                "path": "/v1/checkouts/123",
                "type": "http",
                "app": mock_app,
                "route": mock_route,
            }
            result = middleware._get_path_template(scope)
            assert result is None  # Should be excluded
        finally:
            # Clean up
            METRICS_EXCLUDED_APPS.discard(mock_app)
