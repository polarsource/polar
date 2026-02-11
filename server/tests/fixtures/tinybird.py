import subprocess
import time
import uuid
from collections.abc import Generator
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

from polar.config import settings
from polar.integrations.tinybird import service as tinybird_service
from polar.integrations.tinybird.client import TinybirdClient
from polar.metrics import queries_tinybird

TINYBIRD_DIR = Path(__file__).parent.parent.parent / "tinybird"


def get_tinybird_tokens() -> dict[str, str] | None:
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
    return get_tinybird_tokens() is not None


@pytest.fixture(scope="session")
def tinybird_workspace() -> Generator[str, None, None]:
    """Create an isolated Tinybird workspace, deploy schema, and yield token."""
    tokens = get_tinybird_tokens()
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

    deploy_cmd = ["tb", "--host", host, "--token", workspace_token, "deploy"]
    for attempt in range(3):
        result = subprocess.run(
            deploy_cmd,
            capture_output=True,
            text=True,
            cwd=TINYBIRD_DIR,
        )
        if result.returncode == 0:
            break
        if attempt < 2:
            time.sleep(0.5)
    else:
        raise subprocess.CalledProcessError(
            result.returncode,
            result.args,
            output=result.stdout,
            stderr=result.stderr,
        )

    for _ in range(30):
        try:
            r = httpx.post(
                f"{host}/v0/events",
                params={"name": "events_by_ingested_at", "wait": "true"},
                content="",
                headers={
                    "Authorization": f"Bearer {workspace_token}",
                    "Content-Type": "application/x-ndjson",
                },
                timeout=2,
            )
            if r.status_code != 403:
                break
        except httpx.RequestError:
            pass
        time.sleep(0.5)

    yield workspace_token

    httpx.delete(
        f"{host}/v0/workspaces/{workspace_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )


@pytest.fixture
def tinybird_client(
    tinybird_workspace: str,
) -> Generator[TinybirdClient]:
    client = TinybirdClient(
        api_url=settings.TINYBIRD_API_URL,
        clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
        api_token=tinybird_workspace,
        read_token=tinybird_workspace,
        clickhouse_username=settings.TINYBIRD_CLICKHOUSE_USERNAME,
        clickhouse_token=tinybird_workspace,
    )
    with (
        patch.object(tinybird_service, "client", client),
        patch.object(queries_tinybird, "tinybird_client", client),
    ):
        yield client


__all__ = [
    "get_tinybird_tokens",
    "tinybird_available",
    "tinybird_client",
    "tinybird_workspace",
]
