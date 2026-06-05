"""Tests that mobile/web client identification (polar #12159) is attached to
PostHog *events*, and crucially NOT to person/profile properties.

Isolated from the main Polar infrastructure (see conftest.py): no database or
service connections. Exercises the real path middleware -> ClientContext ->
PostHog capture, with a mocked PostHog client.
"""

import asyncio
from collections.abc import Callable, Iterator
from typing import Any, cast
from unittest.mock import MagicMock

import pytest
from starlette.types import Receive, Scope, Send

from polar.logging import ClientContext


@pytest.fixture
def mock_posthog_client() -> Iterator[MagicMock]:
    from polar.posthog import posthog

    original = posthog.client
    client = MagicMock()
    posthog.client = client
    try:
        yield client
    finally:
        posthog.client = original
        ClientContext.clear()


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


def _run_request(scope: Scope, inside_request: Callable[[], None]) -> None:
    """Drive the middleware; ``inside_request`` runs while ClientContext is
    populated (i.e. as if a handler emitted a PostHog event mid-request)."""
    from polar.middlewares import LogCorrelationIdMiddleware

    async def mock_app(scope: Scope, receive: Receive, send: Send) -> None:
        inside_request()

    middleware = LogCorrelationIdMiddleware(mock_app)

    async def noop_send(message: dict[str, Any]) -> None:
        pass

    asyncio.run(middleware(scope, cast(Receive, None), cast(Send, noop_send)))


def _captured_event_properties(client: MagicMock) -> dict[str, Any]:
    return client.capture.call_args.kwargs["properties"]


class TestPostHogClientContext:
    def test_client_identification_attached_to_events(
        self, mock_posthog_client: MagicMock
    ) -> None:
        from polar.posthog import posthog

        _run_request(
            _http_scope(
                [
                    (b"x-polar-client-version", b"mobile/1.4.0"),
                    (b"x-polar-client-runtime", b"fingerprint-abc"),
                    (b"x-polar-client-update", b"update-xyz"),
                ]
            ),
            lambda: posthog.capture("distinct-id", "backend:test:thing:done"),
        )

        properties = _captured_event_properties(mock_posthog_client)
        assert properties["client_version"] == "mobile/1.4.0"
        assert properties["client_runtime"] == "fingerprint-abc"
        assert properties["client_update"] == "update-xyz"

    def test_client_identification_not_persisted_to_person(
        self, mock_posthog_client: MagicMock
    ) -> None:
        from polar.posthog import posthog

        user = MagicMock(
            posthog_distinct_id="user-1",
            email="a@b.co",
            email_verified=True,
            signup_attribution=None,
        )

        _run_request(
            _http_scope([(b"x-polar-client-version", b"mobile/1.4.0")]),
            lambda: posthog.identify(user),
        )

        person_properties = mock_posthog_client.set.call_args.kwargs["properties"]
        assert "client_version" not in person_properties
        assert "client_runtime" not in person_properties
        assert "client_update" not in person_properties

    def test_no_client_identification_for_non_mobile_request(
        self, mock_posthog_client: MagicMock
    ) -> None:
        from polar.posthog import posthog

        _run_request(
            _http_scope([]),
            lambda: posthog.capture("distinct-id", "backend:test:thing:done"),
        )

        assert "client_version" not in _captured_event_properties(mock_posthog_client)

    def test_context_does_not_leak_after_request(
        self, mock_posthog_client: MagicMock
    ) -> None:
        from polar.posthog import posthog

        _run_request(
            _http_scope([(b"x-polar-client-version", b"mobile/1.4.0")]),
            lambda: None,
        )

        # An event emitted outside the request (e.g. from a worker) must not
        # inherit the previous request's client identification.
        posthog.capture("distinct-id", "backend:test:thing:done")
        assert "client_version" not in _captured_event_properties(mock_posthog_client)
