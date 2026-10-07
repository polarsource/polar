import httpx
import httpx_ws
import pytest


@pytest.mark.anyio
class TestOutpost:
    async def test_basic(self, client: httpx.AsyncClient) -> None:
        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:
            message = await websocket.receive_text()
            assert message == "Hello, Outpost!"
