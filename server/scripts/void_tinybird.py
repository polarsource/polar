import json
import os
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import httpx
import typer

from polar.config import settings
from polar.void.tinybird import get_token

cli = typer.Typer()
PROJECT = Path(__file__).resolve().parents[1] / "void-tinybird"


@cli.command()
def deploy(local: bool = False) -> None:
    """Deploy only to a dedicated Void Tinybird workspace."""
    token = get_token(local=local)
    host = settings.VOID_TINYBIRD_API_URL
    if local:
        if not (
            (settings.is_development() or settings.is_testing())
            and urlparse(host).hostname in {"localhost", "127.0.0.1", "::1"}
        ):
            raise RuntimeError(
                "Local builds require a local development Tinybird server"
            )
        with httpx.Client(
            base_url=host,
            headers={"Authorization": f"Bearer {token}"},
            timeout=120,
        ) as client:
            response = client.get("/v0/datasources")
            response.raise_for_status()
            if any(
                not item["name"].startswith("void_")
                for item in response.json()["datasources"]
            ):
                raise RuntimeError("Void requires a dedicated Tinybird workspace")
            response = client.post(
                "/v1/build",
                files=[
                    ("data_project://", (path.name, path.read_bytes(), "text/plain"))
                    for path in sorted(PROJECT.rglob("*"))
                    if path.suffix in {".datasource", ".pipe"}
                ],
            )
            response.raise_for_status()
            result = response.json()
            if result.get("result") == "failed" or result.get("errors"):
                raise RuntimeError(f"Void Tinybird build failed: {result}")
        print("Void Tinybird local resources built")
        return

    if not settings.VOID_TINYBIRD_WORKSPACE:
        raise RuntimeError("Set POLAR_VOID_TINYBIRD_WORKSPACE to a dedicated workspace")
    env = {**os.environ, "TB_HOST": host, "TB_ADMIN_TOKEN": token}
    result = subprocess.run(
        ["tb", "--output", "json", "info", "--skip-local"],
        cwd=PROJECT,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    import_info = json.loads(result.stdout)
    workspace = import_info.get("cloud", {}).get("workspace_name")
    if workspace != settings.VOID_TINYBIRD_WORKSPACE:
        raise RuntimeError(
            "Tinybird token does not match the configured Void workspace"
        )
    if workspace == settings.TINYBIRD_WORKSPACE:
        raise RuntimeError("Void must use a separate workspace from Polar billing")
    for command in (["build"], ["deploy", "--check"], ["deploy"]):
        subprocess.run(["tb", *command], cwd=PROJECT, env=env, check=True)


if __name__ == "__main__":
    cli()
