import json
import logging
import re
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


def deployment_id(value: object) -> str:
    if type(value) is int and value >= 0:
        return str(value)
    if isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_-]+", value):
        return value
    raise RuntimeError("Tinybird returned an invalid deployment ID")


def deployment_time_remaining(deadline: float) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise RuntimeError("Timed out waiting for Tinybird deployment")
    return remaining


def deployment_request(
    client: httpx.Client, path: str, deadline: float
) -> dict[str, object]:
    while True:
        try:
            response = client.get(
                path, timeout=min(2, deployment_time_remaining(deadline))
            )
        except httpx.RequestError:
            response = None
        if response is not None and response.status_code < 500:
            if response.status_code != 200:
                raise RuntimeError(
                    f"Tinybird deployment API returned HTTP {response.status_code}"
                )
            try:
                payload: object = response.json()
            except ValueError:
                raise RuntimeError(
                    "Tinybird returned invalid deployment JSON"
                ) from None
            if not isinstance(payload, dict) or payload.get("error"):
                raise RuntimeError("Tinybird returned a deployment API error")
            return dict(payload)
        time.sleep(min(0.2, deployment_time_remaining(deadline)))


def deploy_schema(host: str, workspace_token: str) -> None:
    deploy_cmd = [
        "tb",
        "--cloud",
        "--host",
        host,
        "--token",
        workspace_token,
        "--output",
        "json",
        "deploy",
        "--no-wait",
        "--auto",
    ]
    try:
        result = subprocess.run(
            deploy_cmd,
            capture_output=True,
            text=True,
            cwd=TINYBIRD_DIR,
            check=False,
            timeout=300,
        )
    except subprocess.TimeoutExpired, OSError:
        raise RuntimeError("Tinybird deployment submission failed") from None
    deadline = time.monotonic() + 300
    if result.returncode != 0:
        raise RuntimeError(
            f"Tinybird deployment failed with exit code {result.returncode}"
        )
    try:
        submitted: object = json.loads(result.stdout)
    except ValueError:
        raise RuntimeError("Tinybird CLI returned invalid deployment JSON") from None
    if not isinstance(submitted, dict):
        raise RuntimeError("Tinybird CLI did not return a deployment object")
    if submitted.get("error") or submitted.get("errors"):
        raise RuntimeError("Tinybird CLI returned deployment errors")
    new_id = deployment_id(submitted.get("id"))
    with httpx.Client(
        base_url=host, headers={"Authorization": f"Bearer {workspace_token}"}
    ) as client:
        while True:
            payload = deployment_request(client, f"/v1/deployments/{new_id}", deadline)
            deployment = payload.get("deployment")
            if not isinstance(deployment, dict):
                raise RuntimeError("Tinybird returned no deployment object")
            if deployment_id(deployment.get("id")) != new_id:
                raise RuntimeError("Tinybird returned a different deployment")
            status = deployment.get("status")
            if not isinstance(status, str) or not status:
                raise RuntimeError("Tinybird returned an invalid deployment status")
            if (
                status in {"failed", "deleting", "deleted", "error"}
                or deployment.get("error")
                or deployment.get("errors")
            ):
                raise RuntimeError("Tinybird deployment failed before becoming live")
            if status == "data_ready" and deployment.get("live") is True:
                break
            time.sleep(min(0.2, deployment_time_remaining(deadline)))
        deployments = deployment_request(client, "/v1/deployments", deadline).get(
            "deployments"
        )
        if not isinstance(deployments, list):
            raise RuntimeError("Tinybird returned an invalid deployment list")
        for previous in deployments:
            if not isinstance(previous, dict):
                raise RuntimeError("Tinybird returned an invalid previous deployment")
            old_id = deployment_id(previous.get("id"))
            if old_id == new_id:
                continue
            while True:
                old = deployment_request(
                    client, f"/v1/deployments/{old_id}", deadline
                ).get("deployment")
                if old is None or old == {}:
                    return
                if not isinstance(old, dict) or deployment_id(old.get("id")) != old_id:
                    raise RuntimeError("Tinybird returned a different old deployment")
                if old.get("status") == "deleted":
                    return
                if old.get("status") == "failed":
                    logging.getLogger(__name__).warning(
                        "Deployment is live, but the old deployment "
                        "failed to be removed"
                    )
                    return
                time.sleep(min(0.2, deployment_time_remaining(deadline)))


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
def main(token_file: Path | None = None) -> None:
    host = settings.TINYBIRD_API_URL
    try:
        tokens = request("GET", f"{host}/tokens", timeout=2).json()
        _, workspace_token = create_workspace(host, tokens)
        deploy_schema(host, workspace_token)
        wait_for_ingestion(host, workspace_token)

        if token_file is None:
            print(workspace_token)
        else:
            temporary_file = token_file.with_suffix(".tmp")
            temporary_file.write_text(workspace_token)
            temporary_file.replace(token_file)
    except Exception as error:
        if token_file is not None:
            token_file.with_suffix(".error").write_text(type(error).__name__)
        raise


if __name__ == "__main__":
    cli()
