from datetime import UTC, datetime

import anyio
import httpx2
import pytest
from prometheus_client import REGISTRY

import outpost

from .conftest import POLAR_METERS, POLAR_SNAPSHOT_REQUESTS


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
        assert response.status_code == 200
        assert response.json() == {"inserted": 1, "duplicates": 0}

    async def test_duplicates(self, client: httpx2.AsyncClient) -> None:
        event = {
            "timestamp": datetime.now(UTC).isoformat(),
            "name": "tool_call",
            "external_customer_id": "customer_123",
            "external_id": "event_1",
        }
        anonymous = {key: value for key, value in event.items() if key != "external_id"}

        first = await client.post("/ingest", json={"events": [event, event, anonymous]})
        second = await client.post("/ingest", json={"events": [event, anonymous]})

        assert first.json() == {"inserted": 2, "duplicates": 1}
        await wait_for_snapshot_request("customer_123")
        assert second.json() == {"inserted": 1, "duplicates": 1}


@pytest.mark.anyio
class TestActor:
    async def test_invalid_body(self, client: httpx2.AsyncClient) -> None:
        response = await client.post("/actor", json={"foo": "bar"})
        assert response.status_code == 422

    async def test_warms_up(self, client: httpx2.AsyncClient) -> None:
        response = await client.post(
            "/actor", json={"external_customer_id": "actor_customer"}
        )

        assert response.status_code == 202
        await wait_for_snapshot_request("actor_customer")


@pytest.mark.anyio
class TestCustomerMeters:
    async def test_missing_parameters(self, client: httpx2.AsyncClient) -> None:
        response = await client.get(
            "/v1/customer-meters/", params={"external_customer_id": "customer"}
        )
        assert response.status_code == 422

    async def test_unknown_meter(self, client: httpx2.AsyncClient) -> None:
        response = await client.get(
            "/v1/customer-meters/",
            params={"external_customer_id": "customer", "meter_id": "unknown"},
        )
        assert response.status_code == 200
        assert response.json()["items"] == []

    async def test_balance(self, client: httpx2.AsyncClient) -> None:
        await client.post(
            "/ingest",
            json={
                "events": [
                    {
                        "timestamp": datetime.now(UTC).isoformat(),
                        "name": "tool_call",
                        "external_customer_id": "balance_customer",
                    }
                ]
            },
        )

        response = await client.get(
            "/v1/customer-meters/",
            params={
                "external_customer_id": "balance_customer",
                "meter_id": POLAR_METERS[0]["id"],
            },
        )

        assert response.status_code == 200
        assert response.json()["items"] == [
            {
                "external_customer_id": "balance_customer",
                "meter_id": POLAR_METERS[0]["id"],
                "consumed_units": 11,
                "credited_units": 100,
                "balance": 89,
            }
        ]

    async def test_snapshot_timeout(
        self, client: httpx2.AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(outpost, "SNAPSHOT_TIMEOUT", 0.01)

        response = await client.get(
            "/v1/customer-meters/",
            params={
                "external_customer_id": "silent_customer",
                "meter_id": POLAR_METERS[0]["id"],
            },
        )

        assert response.status_code == 504


async def wait_for_snapshot_request(external_customer_id: str) -> None:
    with anyio.fail_after(5):
        while external_customer_id not in POLAR_SNAPSHOT_REQUESTS:
            await anyio.sleep(0.01)


@pytest.mark.anyio
async def test_metrics(client: httpx2.AsyncClient) -> None:
    samples = (
        "outpost_ingest_seconds_count",
        "outpost_reduce_seconds_count",
        "outpost_events_ingested_total",
    )
    before = {sample: REGISTRY.get_sample_value(sample) or 0 for sample in samples}

    ingest_response = await client.post(
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

    assert ingest_response.status_code == 200
    assert response.status_code == 200
    for sample in samples:
        assert REGISTRY.get_sample_value(sample) == before[sample] + 1
        assert sample in response.text


@pytest.mark.anyio
async def test_dashboard(client: httpx2.AsyncClient) -> None:
    response = await client.get("/dashboard")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
