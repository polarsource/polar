import subprocess
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
import typer

from polar.config import settings

cli = typer.Typer()

TINYBIRD_DIR = Path(__file__).resolve().parent.parent / "tinybird"


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
    for _ in range(60):
        try:
            response = httpx.request(method, url, **kwargs)
        except httpx.RequestError:
            time.sleep(1)
            continue
        if response.status_code >= 500:
            time.sleep(1)
            continue
        response.raise_for_status()
        return response
    raise RuntimeError(f"Tinybird never served {url}")


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
