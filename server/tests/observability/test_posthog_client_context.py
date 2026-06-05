"""Tests that mobile client identification flows through to PostHog event properties.

Exercises the real path middleware -> ClientContext ->
PostHog `_get_common_properties`.
"""

import asyncio
from typing import Any, cast

from starlette.types import Receive, Scope, Send


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


def _common_properties_during_request(scope: Scope) -> dict[str, Any]:
    """Run a request through the middleware and return the PostHog common
    properties as seen from inside the request."""
    from polar.middlewares import LogCorrelationIdMiddleware
    from polar.posthog import posthog

    captured: dict[str, Any] = {}

    async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
        captured.update(posthog._get_common_properties())

    middleware = LogCorrelationIdMiddleware(mock_app)

    async def noop_send(message: dict[str, Any]) -> None:
        pass

    asyncio.get_event_loop().run_until_complete(
        middleware(scope, cast(Receive, None), cast(Send, noop_send))
    )
    return captured


class TestPostHogClientContext:
    def test_client_properties_forwarded_during_mobile_request(self) -> None:
        properties = _common_properties_during_request(
            _http_scope(
                [
                    (b"x-polar-client-version", b"mobile/1.4.0"),
                    (b"x-polar-client-runtime", b"fingerprint-abc"),
                    (b"x-polar-client-update", b"update-xyz"),
                ]
            )
        )
        assert properties["client_version"] == "mobile/1.4.0"
        assert properties["client_runtime"] == "fingerprint-abc"
        assert properties["client_update"] == "update-xyz"

    def test_no_client_properties_for_non_mobile_request(self) -> None:
        properties = _common_properties_during_request(_http_scope([]))
        assert "client_version" not in properties
        assert "client_runtime" not in properties
        assert "client_update" not in properties

    def test_context_does_not_leak_after_request(self) -> None:
        from polar.posthog import posthog

        _common_properties_during_request(
            _http_scope([(b"x-polar-client-version", b"mobile/1.4.0")])
        )
        # Events emitted outside the request (e.g. workers) must not inherit
        # the previous request's client identification.
        assert "client_version" not in posthog._get_common_properties()
