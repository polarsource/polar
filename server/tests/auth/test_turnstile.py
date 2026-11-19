from unittest.mock import Mock
from urllib.parse import parse_qs

import pytest
from httpx2 import Response

from polar.auth.turnstile import verify_turnstile
from polar.exceptions import NotPermitted


@pytest.mark.anyio
class TestVerifyTurnstile:
    async def test_success(self, http_mocks: dict[tuple[str, str], Mock]) -> None:
        route = http_mocks[
            "POST", "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        ] = Mock(return_value=Response(200, json={"success": True}))

        await verify_turnstile("test-token", "203.0.113.1")

        request = route.call_args.args[0]
        assert request.headers["content-type"] == "application/x-www-form-urlencoded"
        payload = parse_qs(request.content.decode())
        assert payload["response"] == ["test-token"]
        assert payload["remoteip"] == ["203.0.113.1"]

    async def test_failure(self, http_mocks: dict[tuple[str, str], Mock]) -> None:
        http_mocks[
            "POST", "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        ] = Mock(return_value=Response(200, json={"success": False}))

        with pytest.raises(NotPermitted):
            await verify_turnstile("invalid-token", "203.0.113.1")
