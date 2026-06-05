"""Tests for LogCorrelationIdMiddleware client-identification capture.

Verifies the middleware binds the mobile client headers to the structlog
context for the duration of a request and cleans them up afterwards.
"""

import asyncio
from typing import Any, cast

import structlog
from starlette.types import Receive, Scope, Send


def _run(scope: Scope) -> dict[str, Any]:
    """Run the middleware against ``scope`` and return the structlog
    contextvars as seen from inside the wrapped app."""
    from polar.middlewares import LogCorrelationIdMiddleware

    captured: dict[str, Any] = {}

    async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
        captured.update(structlog.contextvars.get_contextvars())

    middleware = LogCorrelationIdMiddleware(mock_app)

    async def noop_send(message: dict[str, Any]) -> None:
        pass

    asyncio.get_event_loop().run_until_complete(
        middleware(scope, cast(Receive, None), cast(Send, noop_send))
    )
    return captured


def _http_scope(headers: list[tuple[bytes, bytes]]) -> Scope:
    return cast(
        Scope,
        {
            "type": "http",
            "method": "GET",
            "path": "/v1/test",
            "headers": headers,
        },
    )


class TestClientHeaderCapture:
    def test_binds_all_client_headers_when_present(self) -> None:
        captured = _run(
            _http_scope(
                [
                    (b"x-polar-client-version", b"mobile/1.4.0"),
                    (b"x-polar-client-runtime", b"fingerprint-abc"),
                    (b"x-polar-client-update", b"update-xyz"),
                ]
            )
        )
        assert captured["client_version"] == "mobile/1.4.0"
        assert captured["client_runtime"] == "fingerprint-abc"
        assert captured["client_update"] == "update-xyz"

    def test_binds_only_present_headers(self) -> None:
        captured = _run(_http_scope([(b"x-polar-client-version", b"mobile/1.4.0")]))
        assert captured["client_version"] == "mobile/1.4.0"
        assert "client_runtime" not in captured
        assert "client_update" not in captured

    def test_no_client_keys_for_non_mobile_request(self) -> None:
        captured = _run(_http_scope([]))
        assert "client_version" not in captured
        assert "client_runtime" not in captured
        assert "client_update" not in captured

    def test_unbinds_after_request(self) -> None:
        _run(_http_scope([(b"x-polar-client-version", b"mobile/1.4.0")]))
        # Context must not leak past the request lifecycle.
        assert "client_version" not in structlog.contextvars.get_contextvars()
