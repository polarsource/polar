"""Run the complete Void backend and SDK smoke scenario against local services."""

import argparse
import asyncio
import configparser
import contextlib
import fcntl
import hashlib
import json
import os
import shlex
import signal
import subprocess
import sys
import time
from collections.abc import Iterator
from pathlib import Path
from types import FrameType
from typing import TextIO

import httpx
from dotenv import dotenv_values
from temporalio.client import Client
from temporalio.service import RPCError

SERVER = Path(__file__).resolve().parents[1]
CLIENTS = SERVER.parent / "clients"
COMPOSE = SERVER / "docker-compose.void-dev.yml"


def command(args: list[str], env: dict[str, str], cwd: Path, log: TextIO) -> None:
    subprocess.run(
        args, env=env, cwd=cwd, stdout=log, stderr=subprocess.STDOUT, check=True
    )


def environment(arguments: argparse.Namespace, state: Path) -> dict[str, str]:
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(("POLAR_", "VOID_", "AWS_", "LOGFIRE_"))
    }
    env.update(
        {
            "PYTHONPATH": str(SERVER),
            "POLAR_ENV": "development",
            "POLAR_SECRET": "polar-void-local-development",
            "POLAR_LOG_LEVEL": "WARNING",
            "POLAR_JWKS": str(state / ".jwks.json"),
            "POLAR_CURRENT_JWK_KID": "polar_void_dev",
            "POLAR_EMAIL_RENDERER_BINARY_PATH": str(arguments.email_renderer.resolve()),
            "POLAR_POSTGRES_HOST": "127.0.0.1",
            "POLAR_POSTGRES_PORT": str(arguments.postgres_port),
            "POLAR_POSTGRES_DATABASE": "polar_void_dev",
            "POLAR_POSTGRES_USER": "polar",
            "POLAR_POSTGRES_PWD": "polar",
            "POLAR_REDIS_HOST": "127.0.0.1",
            "POLAR_REDIS_PORT": str(arguments.redis_port),
            "POLAR_S3_ENDPOINT_URL": f"http://127.0.0.1:{arguments.minio_port}",
            "POLAR_AWS_ACCESS_KEY_ID": "polar",
            "POLAR_AWS_SECRET_ACCESS_KEY": "polarpolar",
            "POLAR_PYDANTIC_AI_GATEWAY_API_KEY": "void-local-unused",
            "AWS_EC2_METADATA_DISABLED": "true",
            "POLAR_VOID_TEMPORAL_ADDRESS": f"127.0.0.1:{arguments.temporal_port}",
            "POLAR_VOID_TEMPORAL_TASK_QUEUE": "polar-void",
            "POLAR_VOID_TINYBIRD_API_URL": f"http://127.0.0.1:{arguments.tinybird_port}",
            "POLAR_VOID_TEMPORAL_PORT": str(arguments.temporal_port),
            "POLAR_VOID_TEMPORAL_UI_PORT": str(arguments.temporal_ui_port),
            "POLAR_VOID_TINYBIRD_PORT": str(arguments.tinybird_port),
            "POLAR_VOID_DEV_POSTGRES_PORT": str(arguments.postgres_port),
            "POLAR_VOID_DEV_REDIS_PORT": str(arguments.redis_port),
            "POLAR_VOID_DEV_MINIO_PORT": str(arguments.minio_port),
            "POLAR_BASE_URL": f"http://127.0.0.1:{arguments.api_port}",
            "AUTHLIB_INSECURE_TRANSPORT": "true",
        }
    )
    return env


def compose(state: Path, *args: str) -> list[str]:
    suffix = hashlib.sha256(str(state).encode()).hexdigest()[:10]
    return [
        "docker",
        "compose",
        "-p",
        f"polar-void-dev-{suffix}",
        "-f",
        str(COMPOSE),
        *args,
    ]


@contextlib.contextmanager
def private_file(path: Path) -> Iterator[TextIO]:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(descriptor, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        yield stream


def prepare(
    arguments: argparse.Namespace, state: Path, env: dict[str, str], log: TextIO
) -> None:
    command(
        compose(state, "up", "-d", "--wait", "--wait-timeout", "180"), env, SERVER, log
    )
    if not arguments.email_renderer.is_file():
        if arguments.email_renderer != SERVER / "emails/bin/react-email-pkg":
            raise RuntimeError("The configured email renderer does not exist")
        print("Building Polar's backend email renderer...", flush=True)
        command(["uv", "run", "task", "emails"], env, SERVER, log)
    if not (state / ".jwks.json").exists():
        with private_file(state / ".jwks.json") as jwks:
            subprocess.run(
                [sys.executable, "-m", "polar.kit.jwk", "polar_void_dev"],
                env=env,
                cwd=state,
                stdout=jwks,
                stderr=log,
                check=True,
            )
    migrations = configparser.ConfigParser(interpolation=None)
    migrations.read(SERVER / "alembic.ini")
    migrations.set("alembic", "script_location", str(SERVER / "migrations"))
    migrations.set("alembic", "prepend_sys_path", str(SERVER))
    with private_file(state / "alembic.ini") as output:
        migrations.write(output)
    command(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(state / "alembic.ini"),
            "upgrade",
            "head",
        ],
        env,
        state,
        log,
    )
    command(
        [
            sys.executable,
            "-m",
            "scripts.seed_void",
            "--output",
            str(state / "seed.env"),
            "--api-url",
            env["POLAR_BASE_URL"],
        ],
        env,
        state,
        log,
    )
    env.update(
        {
            key: value
            for key, value in dotenv_values(state / "seed.env").items()
            if value is not None
        }
    )
    wait_tinybird(env)
    command([sys.executable, "-m", "scripts.void_tinybird", "--local"], env, state, log)
    with private_file(state / "environment.env") as output:
        for key, value in sorted(env.items()):
            if key.startswith(("POLAR_", "VOID_", "AUTHLIB_", "AWS_EC2_")):
                output.write(f"export {key}={shlex.quote(value)}\n")


def wait_tinybird(env: dict[str, str]) -> None:
    deadline = time.monotonic() + 180
    host = env["POLAR_VOID_TINYBIRD_API_URL"]
    with httpx.Client(timeout=5) as client:
        while time.monotonic() < deadline:
            try:
                token_response = client.get(f"{host}/tokens")
                token_response.raise_for_status()
                token = str(token_response.json()["admin_token"])
                response = client.get(
                    f"{host}/v0/datasources",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if response.status_code == 200:
                    env["POLAR_VOID_TINYBIRD_API_TOKEN"] = token
                    return
            except httpx.HTTPError, ValueError, KeyError:
                pass
            time.sleep(1)
    raise RuntimeError("Tinybird's data API did not become ready within 180 seconds")


def wait_api(processes: list[subprocess.Popen[str]], env: dict[str, str]) -> None:
    deadline = time.monotonic() + 60
    with httpx.Client(timeout=2) as client:
        while time.monotonic() < deadline:
            if any(process.poll() is not None for process in processes):
                raise RuntimeError(
                    "API or worker exited during startup; inspect the local logs"
                )
            try:
                response = client.get(
                    f"{env['VOID_API_URL']}/v1/void/organizations/current",
                    headers={
                        "Authorization": f"Bearer {env['VOID_TOKEN']}",
                        "Polar-Version": "2026-04",
                    },
                )
                if response.status_code == 200:
                    return
            except httpx.TransportError:
                pass
            time.sleep(0.25)
    raise RuntimeError("Polar API did not become ready within 60 seconds")


async def trigger_cycle(env: dict[str, str]) -> None:
    client = await Client.connect(env["POLAR_VOID_TEMPORAL_ADDRESS"])
    handle = client.get_schedule_handle(
        f"{env['POLAR_VOID_TEMPORAL_TASK_QUEUE']}-dispatch-meter-cycles"
    )
    for attempt in range(30):
        try:
            await handle.trigger()
            return
        except RPCError:
            if attempt == 29:
                raise
            await asyncio.sleep(1)


def stop(processes: list[subprocess.Popen[str]]) -> None:
    for process in reversed(processes):
        if process.poll() is None:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGTERM)
    for process in reversed(processes):
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
            process.wait()


def run(arguments: argparse.Namespace) -> None:
    state = arguments.state_dir.resolve()
    if (
        state.exists()
        and any(state.iterdir())
        and not (state / ".void-dev-state").is_file()
    ):
        raise RuntimeError(
            "Choose an empty state directory or an existing Void development state directory"
        )
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    (state / ".void-dev-state").touch(mode=0o600)
    os.chmod(state, 0o700)
    env = environment(arguments, state)
    processes: list[subprocess.Popen[str]] = []
    with (state / "runner.lock").open("w") as lock, contextlib.ExitStack() as stack:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError(
                "This Void setup is already running; stop its runner first"
            ) from error
        log = stack.enter_context(private_file(state / "setup.log"))
        down = compose(
            state, "down", *(["--volumes"] if arguments.remove_volumes else [])
        )
        if arguments.action == "down":
            command(down, env, SERVER, log)
            print("Void development services stopped")
            return
        try:
            print(f"Preparing local Void services. Logs: {state}", flush=True)
            prepare(arguments, state, env, log)
            for name, args in (
                (
                    "api",
                    [
                        sys.executable,
                        "-m",
                        "uvicorn",
                        "polar.app:app",
                        "--host",
                        "127.0.0.1",
                        "--port",
                        str(arguments.api_port),
                        "--no-access-log",
                    ],
                ),
                ("worker", [sys.executable, "-m", "polar.void.worker"]),
            ):
                output = stack.enter_context(private_file(state / f"{name}.log"))
                processes.append(
                    subprocess.Popen(
                        args,
                        env=env,
                        cwd=state,
                        stdout=output,
                        stderr=subprocess.STDOUT,
                        text=True,
                        start_new_session=True,
                    )
                )
            wait_api(processes, env)
            print(
                f"Polar API ready at {env['VOID_API_URL']}. Environment: {state / 'environment.env'}",
                flush=True,
            )
            if arguments.action == "run":
                while all(process.poll() is None for process in processes):
                    time.sleep(1)
                raise RuntimeError(
                    "API or worker stopped unexpectedly; inspect the local logs"
                )
            smoke = subprocess.Popen(
                ["pnpm", "--filter", "@void/sdk", "smoke"],
                env=env,
                cwd=CLIENTS,
                stdout=subprocess.PIPE,
                stderr=log,
                text=True,
                start_new_session=True,
            )
            processes.append(smoke)
            assert smoke.stdout is not None
            for line in smoke.stdout:
                print(line, end="", flush=True)
                try:
                    stage = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(stage, dict) and stage.get("stage") == "cycle_ready":
                    asyncio.run(trigger_cycle(env))
            if smoke.wait() != 0:
                raise RuntimeError("SDK smoke scenario failed; inspect setup.log")
            print("Full Void smoke scenario passed", flush=True)
        finally:
            try:
                stop(processes)
            finally:
                command(down, env, SERVER, log)


def interrupt(signum: int, frame: FrameType | None) -> None:
    raise KeyboardInterrupt


def main() -> None:
    signal.signal(signal.SIGTERM, interrupt)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("run", "smoke", "down"))
    parser.add_argument("--state-dir", type=Path, default=SERVER / ".void-dev")
    parser.add_argument(
        "--remove-volumes",
        action="store_true",
        help="Remove this setup's Docker volumes after stopping",
    )
    parser.add_argument(
        "--email-renderer",
        type=Path,
        default=Path(
            os.environ.get(
                "POLAR_EMAIL_RENDERER_BINARY_PATH",
                SERVER / "emails/bin/react-email-pkg",
            )
        ),
    )
    for name, default in (
        ("api", 8010),
        ("postgres", 5544),
        ("redis", 6384),
        ("minio", 9180),
        ("tinybird", 7281),
        ("temporal", 7333),
        ("temporal-ui", 8333),
    ):
        parser.add_argument(f"--{name}-port", type=int, default=default)
    arguments = parser.parse_args()
    try:
        run(arguments)
    except KeyboardInterrupt:
        if arguments.action != "run":
            parser.exit(130, "Void development command interrupted\n")
        print("Void development services stopped")
    except (RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
