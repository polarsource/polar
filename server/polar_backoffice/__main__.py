import argparse
import contextlib
import os
import subprocess
from collections.abc import Generator
from typing import NamedTuple, TypeAlias

import httpx
from halo import Halo


class Tunnel(NamedTuple):
    local_port: int
    remote_host: str
    remote_port: int


EnvVars: TypeAlias = dict[str, str]

IGNORED_ENVIRONMENT_VARIABLES = {
    "POLAR_JWKS",
}


def _load_production_environment(
    render_api_key: str, render_service_id: str
) -> EnvVars:
    ENVIRONMENT_GROUPS = {"github-production", "server-common", "server-stripe"}

    environment_variables: EnvVars = {}
    with httpx.Client(
        base_url="https://api.render.com/v1",
        headers={"Authorization": f"Bearer {render_api_key}"},
    ) as client:
        response = client.get("/env-groups")
        response.raise_for_status()

        json = response.json()
        for item in json:
            environment_group = item["envGroup"]
            if environment_group["name"] not in ENVIRONMENT_GROUPS:
                continue
            for environment_variable in environment_group["envVars"]:
                environment_variables[environment_variable["key"]] = (
                    environment_variable["value"]
                )

        response = client.get(f"/services/{render_service_id}/env-vars")
        response.raise_for_status()

        json = response.json()
        for item in json:
            environment_variable = item["envVar"]
            environment_variables[environment_variable["key"]] = environment_variable[
                "value"
            ]

    return environment_variables


def _set_tunnels(environment_variables: EnvVars) -> tuple[EnvVars, list[Tunnel]]:
    SERVERS = {"POSTGRES", "REDIS"}
    tunnels: list[Tunnel] = []
    local_port = 49152
    for server in SERVERS:
        remote_host = environment_variables[f"POLAR_{server}_HOST"]
        remote_port = int(environment_variables[f"POLAR_{server}_PORT"])

        environment_variables[f"POLAR_{server}_HOST"] = "localhost"
        environment_variables[f"POLAR_{server}_PORT"] = str(local_port)
        tunnels.append(Tunnel(local_port, remote_host, remote_port))
        local_port += 1
    return environment_variables, tunnels


def _set_environment_variables(environment_variables: EnvVars) -> None:
    os.environ["POLAR_ENV"] = environment_variables["POLAR_ENV"]
    for key, value in environment_variables.items():
        if key not in IGNORED_ENVIRONMENT_VARIABLES:
            os.environ[key] = value


def _get_ssh_hostname(render_api_key: str, render_service_id: str) -> str:
    with httpx.Client(
        base_url="https://api.render.com/v1",
        headers={"Authorization": f"Bearer {render_api_key}"},
    ) as client:
        response = client.get(f"/services/{render_service_id}")
        response.raise_for_status()

        json = response.json()

        region = json["serviceDetails"]["region"]
        return f"{render_service_id}@ssh.{region}.render.com"


@contextlib.contextmanager
def _open_ssh(
    hostname: str, tunnels: list[Tunnel]
) -> Generator[subprocess.Popen[str], None, None]:
    process = subprocess.Popen(
        [
            "ssh",
            *(
                f"-L localhost:{local_port}:{remote_host}:{remote_port}"
                for (local_port, remote_host, remote_port) in tunnels
            ),
            "-N",
            hostname,
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )
    assert process.stdin is not None
    assert process.stdout is not None
    process.stdout.read()
    yield process
    process.terminate()


if __name__ == "__main__":
    env_render_api_key = os.environ.get("POLAR_BACKOFFICE_RENDER_API_KEY")
    env_render_service_id = os.environ.get("POLAR_BACKOFFICE_RENDER_SERVICE_ID")
    parser = argparse.ArgumentParser(prog="python -m polar_backoffice")
    parser.add_argument(
        "--render-api-key",
        type=str,
        default=env_render_api_key,
        required=env_render_api_key is None,
        help=(
            "A valid Render API key. "
            "Fallback to POLAR_BACKOFFICE_RENDER_API_KEY environment variable."
        ),
    )
    parser.add_argument(
        "--render-service-id",
        type=str,
        default=env_render_service_id,
        required=env_render_service_id is None,
        help=(
            "The Render service ID to connect through SSH. "
            "Fallback to POLAR_BACKOFFICE_RENDER_SERVICE_ID environment variable."
        ),
    )
    args = parser.parse_args()

    spinner = Halo(
        text="Retrieving production environment variables...", spinner="dots"
    )
    spinner.start()

    environment_variables = _load_production_environment(
        args.render_api_key, args.render_service_id
    )
    environment_variables, tunnels = _set_tunnels(environment_variables)
    _set_environment_variables(environment_variables)

    spinner.text = "Opening SSH connection..."
    ssh_hostname = _get_ssh_hostname(args.render_api_key, args.render_service_id)
    with _open_ssh(ssh_hostname, tunnels):
        spinner.text = "Loading app..."

        from .app import PolarBackOffice

        app = PolarBackOffice()
        spinner.stop()
        app.run()
