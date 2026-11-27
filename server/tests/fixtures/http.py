from unittest.mock import Mock
from urllib.parse import unquote

import httpx
import httpx2
import pytest


@pytest.fixture
def http_mocks(monkeypatch: pytest.MonkeyPatch) -> dict[tuple[str, str], Mock]:
    mocks: dict[tuple[str, str], Mock] = {}

    def handle(request: httpx2.Request) -> httpx2.Response:
        url = unquote(str(request.url.copy_with(query=None)))
        assert (request.method, url) in mocks, (
            f"Unexpected request: {request.method} {url}"
        )
        return mocks[request.method, url](request)

    transport = httpx2.MockTransport(handle)
    original = httpx2.AsyncClient._transport_for_url

    def transport_for_url(
        client: httpx2.AsyncClient, url: httpx2.URL
    ) -> httpx2.AsyncBaseTransport:
        existing = original(client, url)
        return existing if isinstance(existing, httpx2.ASGITransport) else transport

    monkeypatch.setattr(httpx2.AsyncClient, "_transport_for_url", transport_for_url)
    return mocks


@pytest.fixture
def oauth_http_mocks(monkeypatch: pytest.MonkeyPatch) -> dict[tuple[str, str], Mock]:
    mocks: dict[tuple[str, str], Mock] = {}

    def handle(request: httpx.Request) -> httpx.Response:
        url = unquote(str(request.url.copy_with(query=None)))
        assert (request.method, url) in mocks, (
            f"Unexpected request: {request.method} {url}"
        )
        return mocks[request.method, url](request)

    transport = httpx.MockTransport(handle)
    monkeypatch.setattr(
        httpx.AsyncClient, "_transport_for_url", lambda self, url: transport
    )
    return mocks
