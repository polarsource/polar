import httpx2
import pytest


@pytest.mark.anyio
class TestIngest:
    async def test_no_body(self, client: httpx2.AsyncClient) -> None:
        response = await client.post("/v1/events/ingest")
        assert response.status_code == 422

    async def test_invalid_body(self, client: httpx2.AsyncClient) -> None:
        response = await client.post("/v1/events/ingest", json={"foo": "bar"})
        assert response.status_code == 422

    async def test_valid_body(self, client: httpx2.AsyncClient) -> None:
        response = await client.post(
            "/v1/events/ingest",
            json={
                "events": [
                    {
                        "timestamp": "2026-01-01T00:00:00Z",
                        "name": "tool_call",
                        "external_customer_id": "customer_123",
                        "metadata": {"key": "value"},
                    }
                ]
            },
        )
        assert response.status_code == 200
        assert response.json() == {"inserted": 1, "duplicates": 0}
