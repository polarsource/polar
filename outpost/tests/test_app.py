import httpx2
import pytest


@pytest.mark.anyio
class TestIngest:
    async def test_no_body(self, client: httpx2.AsyncClient) -> None:
        response = await client.post("/ingest")
        assert response.status_code == 422

    async def test_invalid_body(self, client: httpx2.AsyncClient) -> None:
        response = await client.post("/ingest", json={"foo": "bar"})
        assert response.status_code == 422

    async def test_valid_body(self, client: httpx2.AsyncClient) -> None:
        response = await client.post(
            "/ingest",
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
        assert response.status_code == 202


@pytest.mark.anyio
async def test_metrics(client: httpx2.AsyncClient) -> None:
    await client.post(
        "/ingest",
        json={
            "events": [
                {
                    "timestamp": "2026-01-01T00:00:00Z",
                    "name": "tool_call",
                    "external_customer_id": "customer_123",
                }
            ]
        },
    )

    response = await client.get("/metrics")

    assert response.status_code == 200
    assert "outpost_ingest_seconds_count" in response.text
    assert "outpost_reduce_seconds_count" in response.text
    assert "outpost_events_ingested_total" in response.text
