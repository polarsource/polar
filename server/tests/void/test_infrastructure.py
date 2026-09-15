import httpx
import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.void.tinybird import TinybirdApi, VoidInfrastructureUnavailable, get_token


class TestTinybirdDelivery:
    def test_waits_for_complete_ingestion(self) -> None:
        requests: list[httpx.Request] = []

        def respond(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(
                200, json={"successful_rows": 1, "quarantined_rows": 0}
            )

        api = TinybirdApi(base_url="https://void.example", token="testing")
        api.client.close()
        api.client = httpx.Client(
            base_url="https://void.example", transport=httpx.MockTransport(respond)
        )
        try:
            api.ingest_batch("void_events", [{"external_id": "one"}])
            assert requests[0].url.params["wait"] == "true"
            assert requests[0].url.params["name"] == "void_events"
            assert requests[0].read() == b'{"external_id": "one"}'
        finally:
            api.close()

    @pytest.mark.parametrize(
        "result",
        [
            {"successful_rows": 0, "quarantined_rows": 1},
            {"successful_rows": 0, "quarantined_rows": 0},
            {},
        ],
    )
    def test_partial_ingestion_is_not_acknowledged(
        self, result: dict[str, int]
    ) -> None:
        api = TinybirdApi(base_url="https://void.example", token="testing")
        api.client.close()
        api.client = httpx.Client(
            base_url="https://void.example",
            transport=httpx.MockTransport(lambda _: httpx.Response(200, json=result)),
        )
        try:
            with pytest.raises(RuntimeError, match="entire batch"):
                api.ingest_batch("void_events", [{"external_id": "one"}])
        finally:
            api.close()

    def test_rejects_native_resources(self) -> None:
        api = TinybirdApi(base_url="https://void.example", token="testing")
        try:
            with pytest.raises(ValueError, match="Expected"):
                api.ingest_batch("events", [])
            with pytest.raises(ValueError, match="Expected"):
                api.query("events_list", {})
        finally:
            api.close()

    def test_missing_token_does_not_discover_credentials(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "VOID_TINYBIRD_API_TOKEN", None)
        request = mocker.patch("polar.void.tinybird.httpx.get")
        with pytest.raises(VoidInfrastructureUnavailable):
            get_token()
        request.assert_not_called()
