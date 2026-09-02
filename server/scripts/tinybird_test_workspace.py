import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
import typer

from polar.config import settings

cli = typer.Typer()

TINYBIRD_DIR = Path(__file__).resolve().parent.parent / "tinybird"

# Tinybird Local answers /tokens before setup finishes. setup also exits 1 once
# and is respawned by supervisord; the workspace API can take >60s after that.
API_READY_ATTEMPTS = 180


def get_tokens(host: str | None = None) -> dict[str, str] | None:
    host = host or settings.TINYBIRD_API_URL
    try:
        response = httpx.get(f"{host}/tokens", timeout=2)
        if response.status_code == 200:
            return response.json()
    except httpx.RequestError:
        pass
    return None


def request(method: str, url: str, **kwargs: Any) -> httpx.Response:
    """Tinybird answers /tokens before its API is up, so retry past gateway errors."""
    last_error = "no response"
    for attempt in range(1, API_READY_ATTEMPTS + 1):
        try:
            response = httpx.request(method, url, **kwargs)
        except httpx.RequestError as exc:
            last_error = str(exc)
        else:
            if response.status_code < 500:
                response.raise_for_status()
                return response
            last_error = f"HTTP {response.status_code}"
        if attempt % 15 == 0:
            print(
                f"Waiting for Tinybird {url} ({last_error}, attempt {attempt}/{API_READY_ATTEMPTS})",
                file=sys.stderr,
            )
        time.sleep(1)
    raise RuntimeError(f"Tinybird never served {url} ({last_error})")


def create_workspace(host: str, tokens: dict[str, str]) -> tuple[str, str]:
    user_token = tokens["user_token"]
    admin_token = tokens["admin_token"]
    workspace_name = f"test_{uuid.uuid4().hex[:8]}"

    organization_response = request(
        "GET",
        f"{host}/v1/user/workspaces",
        params={"with_organization": "true", "token": admin_token},
    )
    organization_id = organization_response.json()["organization_id"]

    ws_response = request(
        "POST",
        f"{host}/v1/workspaces",
        params={"name": workspace_name, "assign_to_organization_id": organization_id},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    workspace_id = ws_response.json()["id"]

    workspaces_response = request(
        "GET",
        f"{host}/v1/user/workspaces",
        params={"token": user_token},
    )
    workspace_token = next(
        workspace["token"]
        for workspace in workspaces_response.json()["workspaces"]
        if workspace["id"] == workspace_id
    )

    return workspace_id, workspace_token


def deploy_schema(host: str, workspace_token: str) -> None:
    deploy_cmd = [
        "tb",
        "--cloud",
        "--host",
        host,
        "--token",
        workspace_token,
        "deploy",
        "--wait",
    ]
    for attempt in range(3):
        result = subprocess.run(
            deploy_cmd,
            capture_output=True,
            text=True,
            cwd=TINYBIRD_DIR,
            check=False,
        )
        if result.returncode == 0:
            return
        if attempt < 2:
            time.sleep(0.5)
    raise RuntimeError(
        "Tinybird deploy failed after 3 attempts.\n"
        f"Command: {' '.join(result.args)}\n"
        f"Exit code: {result.returncode}\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )


def wait_for_ingestion(host: str, workspace_token: str) -> None:
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
                return
        except httpx.RequestError:
            pass
        time.sleep(0.5)


def delete_workspace(host: str, workspace_id: str, user_token: str) -> None:
    httpx.delete(
        f"{host}/v1/workspaces/{workspace_id}",
        params={"hard_delete_confirmation": "yes"},
        headers={"Authorization": f"Bearer {user_token}"},
    )


@cli.command()
def main() -> None:
    host = settings.TINYBIRD_API_URL
    tokens = request("GET", f"{host}/tokens", timeout=2).json()
    _, workspace_token = create_workspace(host, tokens)
    deploy_schema(host, workspace_token)
    wait_for_ingestion(host, workspace_token)

    print(workspace_token)


if __name__ == "__main__":
    cli()
