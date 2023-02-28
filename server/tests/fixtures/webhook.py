from __future__ import annotations

import json
from typing import Any, AsyncGenerator

import pytest
from httpx import AsyncClient, Response

from polar.clients import github
from polar.config import settings


class TestWebhook:
    __test__ = False  # This is a base class, not a test

    def __init__(
        self,
        headers: dict[str, Any],
        data: bytes,
        json: dict[str, Any],
        client: AsyncClient,
    ) -> None:
        self.headers = headers
        self.data = data
        self.json = json
        self.client = client

    async def send(self) -> Response:
        response = await self.client.post(
            "/api/v1/integrations/github/webhook",
            json=self.json,
            headers=self.headers,
        )
        print("zegl, response", response.status_code, response.json())
        return response

    def __getitem__(self, key: str) -> Any:
        return self.json[key]


class TestWebhookFactory:
    __test__ = False  # This is a base class, not a test

    def __init__(self, client: AsyncClient):
        self.client = client

    def generate_cassette(self, name: str) -> dict[str, Any]:
        filename = f"tests/fixtures/cassettes/webhooks/github/{name}.json"
        with open(filename, "r") as fp:
            cassette: dict[str, Any] = json.loads(fp.read())

        data = json.dumps(cassette["body"]).encode()
        signature = github.webhooks.sign(
            settings.GITHUB_APP_WEBHOOK_SECRET, data, method="sha256"
        )

        cassette["data"] = data
        cassette["headers"]["X-Hub-Signature-256"] = signature
        return cassette

    def create(self, name: str) -> TestWebhook:
        cassette = self.generate_cassette(name)
        return TestWebhook(
            cassette["headers"],
            cassette["data"],
            cassette["body"],
            self.client,
        )


@pytest.fixture()
async def github_webhook(
    client: AsyncClient,
) -> AsyncGenerator[TestWebhookFactory, None]:
    factory = TestWebhookFactory(client)
    yield factory
