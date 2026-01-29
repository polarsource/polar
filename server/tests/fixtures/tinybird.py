import subprocess
import uuid
from collections.abc import Generator
from pathlib import Path

import httpx
import pytest

from polar.config import settings

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


__all__ = ["get_tinybird_tokens", "tinybird_available", "tinybird_workspace"]
