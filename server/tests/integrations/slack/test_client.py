import json

import httpx2
import pytest

from polar.integrations.slack.client import BASE_URL, SlackClient


@pytest.mark.anyio
class TestConversationsInviteShared:
    async def test_sends_single_email_array_payload(self) -> None:
        requests: list[httpx2.Request] = []

        async def handler(request: httpx2.Request) -> httpx2.Response:
            requests.append(request)
            return httpx2.Response(200, json={"ok": True})

        slack_client = SlackClient()
        await slack_client.client.aclose()
        slack_client.client = httpx2.AsyncClient(
            base_url=BASE_URL,
            transport=httpx2.MockTransport(handler),
        )

        try:
            response = await slack_client.conversations_invite_shared(
                bot_token="xoxb-test-token",
                channel="C123",
                email="user@example.com",
            )
        finally:
            await slack_client.aclose()

        assert response == {"ok": True}
        assert len(requests) == 1

        request = requests[0]
        assert request.url.path == "/api/conversations.inviteShared"
        assert request.headers["Authorization"] == "Bearer xoxb-test-token"
        assert json.loads(request.content) == {
            "channel": "C123",
            "emails": ["user@example.com"],
            "external_limited": True,
        }
