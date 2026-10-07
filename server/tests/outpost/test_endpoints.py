import httpx
import httpx_ws
import pytest
from pytest_mock import MockerFixture

from polar.models import Meter
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.anyio
class TestOutpost:
    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_request_configuration(
        self, client: httpx.AsyncClient, mocker: MockerFixture, meter: Meter
    ) -> None:
        async with httpx_ws.aconnect_ws("/v1/outpost/", client=client) as websocket:  # type: ignore[var-annotated]
            await websocket.send_json({"type": "configuration"})
            configuration = await websocket.receive_json()

            assert configuration["type"] == "configuration"
            assert configuration["payload"]["meters"][0]["id"] == str(meter.id)
