from collections.abc import Iterator

import httpx
import pytest

from polar.integrations.tinybird.client import TinybirdClient, _fetch_local_token
from polar.integrations.tinybird.service import _event_to_tinybird

from .test_service import create_test_event

TINYBIRD_LOCAL_URL = "http://localhost:7181"
TINYBIRD_CLICKHOUSE_URL = "http://localhost:7182"


def _tinybird_is_available() -> str | None:
    """Check if Tinybird local is available and return the admin token."""
    return _fetch_local_token(TINYBIRD_LOCAL_URL)


def _delete_datasource(token: str, name: str) -> None:
    """Delete a datasource via Tinybird API."""
    httpx.delete(
        f"{TINYBIRD_LOCAL_URL}/v0/datasources/{name}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )


@pytest.fixture(scope="session")
def tinybird_token() -> str:
    """Get Tinybird token, skip if not available."""
    token = _tinybird_is_available()
    if not token:
        pytest.skip("Tinybird local not available")
    return token


@pytest.fixture(scope="session")
def tinybird_datasource(worker_id: str, tinybird_token: str) -> Iterator[str]:
    """Get a unique datasource name per worker, clean up after."""
    datasource_name = f"events_{worker_id}"
    _delete_datasource(tinybird_token, datasource_name)
    yield datasource_name
    _delete_datasource(tinybird_token, datasource_name)


@pytest.fixture
def tinybird_client(tinybird_token: str) -> TinybirdClient:
    return TinybirdClient(
        api_url=TINYBIRD_LOCAL_URL,
        clickhouse_url=TINYBIRD_CLICKHOUSE_URL,
        api_token=tinybird_token,
    )


@pytest.mark.asyncio
class TestTinybirdClient:
    async def test_ingest_and_query(
        self, tinybird_client: TinybirdClient, tinybird_datasource: str
    ) -> None:
        event = create_test_event(name="test.event")
        tinybird_event = _event_to_tinybird(event)

        await tinybird_client.ingest(tinybird_datasource, [tinybird_event], wait=True)

        results = await tinybird_client.query(
            f"SELECT * FROM {tinybird_datasource} WHERE id = '{event.id}'"
        )

        assert len(results) == 1
        assert results[0]["id"] == str(event.id)
        assert results[0]["name"] == "test.event"
