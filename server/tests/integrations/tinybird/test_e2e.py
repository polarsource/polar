import subprocess
import uuid
from collections.abc import Generator
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest

from polar.config import settings
from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.service import DATASOURCE_EVENTS, _event_to_tinybird
from polar.models import Event
from polar.models.event import EventSource

TINYBIRD_DIR = Path(__file__).parent.parent.parent.parent / "tinybird"


def create_test_event(
    *,
    organization_id: uuid.UUID | None = None,
    name: str = "test.event",
    source: EventSource = EventSource.system,
    user_metadata: dict[str, object] | None = None,
) -> Event:
    now = datetime.now(UTC)
    return Event(
        id=uuid.uuid4(),
        ingested_at=now,
        timestamp=now,
        name=name,
        source=source,
        organization_id=organization_id or uuid.uuid4(),
        user_metadata=user_metadata or {},
    )


def get_tokens() -> dict[str, str] | None:
    """Fetch tokens from local Tinybird instance."""
    try:
        response = httpx.get(f"{settings.TINYBIRD_API_URL}/tokens", timeout=2)
        if response.status_code == 200:
            return response.json()
    except httpx.RequestError:
        pass
    return None


def tinybird_available() -> bool:
    """Check if local Tinybird is running and accessible."""
    return get_tokens() is not None


@pytest.fixture
def tinybird_workspace() -> Generator[str, None, None]:
    """Create an isolated workspace, deploy schema, and yield token."""
    tokens = get_tokens()
    if not tokens:
        pytest.skip("Tinybird not running")

    user_token = tokens["user_token"]
    admin_token = tokens["admin_token"]
    host = settings.TINYBIRD_API_URL
    workspace_name = f"test_{uuid.uuid4().hex[:8]}"

    ws_response = httpx.post(
        f"{host}/v0/workspaces",
        params={"name": workspace_name},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    ws_response.raise_for_status()
    workspace_id = ws_response.json()["id"]

    token_name = f"admin_{workspace_name}"
    token_response = httpx.post(
        f"{host}/v0/tokens",
        params={"name": token_name, "scope": "ADMIN"},
        headers={
            "Authorization": f"Bearer {admin_token}",
            "X-Workspace-ID": workspace_id,
        },
    )
    token_response.raise_for_status()
    workspace_token = token_response.json()["token"]

    subprocess.run(
        ["tb", "--host", host, "--token", workspace_token, "deploy"],
        check=True,
        capture_output=True,
        cwd=TINYBIRD_DIR,
    )

    yield workspace_token

    httpx.delete(
        f"{host}/v0/workspaces/{workspace_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
class TestTinybirdE2E:
    async def test_ingest_and_query(self, tinybird_workspace: str) -> None:
        """Verify events can be ingested and queried back."""
        token = tinybird_workspace
        client = TinybirdClient(settings.TINYBIRD_API_URL, api_token=token)

        event = create_test_event(name="test.e2e.event")
        tinybird_event = _event_to_tinybird(event)

        await client.ingest(DATASOURCE_EVENTS, [tinybird_event], wait=True)

        async with httpx.AsyncClient(
            base_url=settings.TINYBIRD_API_URL,
            headers={"Authorization": f"Bearer {token}"},
        ) as http:
            response = await http.get(
                "/v0/sql",
                params={
                    "q": f"SELECT * FROM {DATASOURCE_EVENTS} WHERE id = '{event.id}' FORMAT JSON"
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data.get("data", [])) == 1
            assert data["data"][0]["name"] == "test.e2e.event"
