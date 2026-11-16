import argparse
import concurrent.futures
import json
import re
import subprocess
import time
from pathlib import Path
from typing import TypedDict


class Image(TypedDict):
    id: str
    digests: list[str]
    architecture: str
    container_started_at: str
    healthcheck: dict[str, object]


IMAGES = {
    "postgres": "postgres:18.6-bookworm",
    "redis": "redis:7.4-alpine",
    "tinybird": "tinybirdco/tinybird-local@sha256:f7358a3a289f5a9b2622b84cff4c69032e013306b6b107395580661fa7777666",
}


def docker(*arguments: str) -> str:
    result = subprocess.run(
        ["docker", *arguments], capture_output=True, text=True, check=False, timeout=120
    )
    if result.stderr:
        print(result.stderr, end="", flush=True)
    result.check_returncode()
    return result.stdout


def start_service(prefix: str, service: str) -> Image:
    arguments = [
        "run",
        "-d",
        "--name",
        f"{prefix}-{service}",
        "-e",
        "GITHUB_ACTIONS=true",
        "-e",
        "CI=true",
        "--health-interval",
        "10s",
        "--health-timeout",
        "5s",
        "--health-retries",
        "5",
        "--health-start-interval",
        "500ms",
    ]
    match service:
        case "postgres":
            arguments.extend(
                [
                    "--health-cmd",
                    "pg_isready",
                    "--health-start-period",
                    "10s",
                    "-e",
                    "POSTGRES_PORT=5432",
                ]
            )
            arguments.extend(
                [
                    "-p",
                    "5432:5432",
                    "-e",
                    "POSTGRES_USER=polar",
                    "-e",
                    "POSTGRES_PASSWORD=polar",
                    "-e",
                    "POSTGRES_DB=polar_test",
                ]
            )
        case "redis":
            arguments.extend(
                ["--health-cmd", "redis-cli ping", "--health-start-period", "10s"]
            )
            arguments.extend(["-p", "6379:6379"])
        case "tinybird":
            arguments.extend(
                ["--health-cmd", "curl -s http://127.0.0.1:7181/tokens || exit 1"]
            )
            arguments.extend(
                [
                    "-p",
                    "7181:7181",
                    "-p",
                    "7182:7182",
                    "--cpus",
                    "4",
                    "-e",
                    "TB_LOCAL_CSV_WORKERS=1",
                    "-e",
                    "TB_LOCAL_MCP=false",
                    "-e",
                    "TB_LOCAL_KAFKA=false",
                ]
            )
    docker(*arguments, IMAGES[service])
    image: Image = json.loads(
        docker(
            "image",
            "inspect",
            "--format",
            '{"id":{{json .Id}},"digests":{{json .RepoDigests}},"architecture":{{json .Architecture}}}',
            IMAGES[service],
        )
    )
    container = json.loads(
        docker(
            "container",
            "inspect",
            "--format",
            '{"id":{{json .Image}},"started_at":{{json .State.StartedAt}},"healthcheck":{{json .Config.Healthcheck}}}',
            f"{prefix}-{service}",
        )
    )
    if container["id"] != image["id"]:
        raise RuntimeError(f"Running {service} image differs from its recorded digest")
    image["container_started_at"] = container["started_at"]
    image["healthcheck"] = container["healthcheck"]
    for digest in image["digests"]:
        print(f"{service} Digest: {digest.split('@', 1)[1]}", flush=True)
    return image


def start(prefix: str, result_file: Path, tinybird: bool) -> None:
    services = ["postgres", "redis", *(["tinybird"] if tinybird else [])]
    images: dict[str, Image] = {}
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(services)) as pool:
            futures = {
                name: pool.submit(start_service, prefix, name) for name in services
            }
            for name, future in futures.items():
                images[name] = future.result()
        deadline = time.monotonic() + 120
        for command in [
            [
                "exec",
                f"{prefix}-postgres",
                "pg_isready",
                "-U",
                "polar",
                "-d",
                "polar_test",
            ],
            ["exec", f"{prefix}-redis", "redis-cli", "ping"],
        ]:
            while True:
                try:
                    docker(*command)
                    break
                except subprocess.CalledProcessError:
                    if time.monotonic() >= deadline:
                        raise RuntimeError(f"Service never became ready: {command[1]}")
                    time.sleep(0.1)
    except Exception as error:
        write_result(result_file, images, str(error))
        raise
    write_result(result_file, images)


def write_result(
    path: Path, images: dict[str, Image], error: str | None = None
) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps({"success": error is None, "error": error, "images": images})
    )
    temporary.replace(path)


def wait_for_services(result_file: Path, timeout: float = 120) -> None:
    deadline = time.monotonic() + timeout
    while not result_file.exists():
        if time.monotonic() >= deadline:
            raise RuntimeError("Timed out waiting for CI services")
        time.sleep(0.05)
    result = json.loads(result_file.read_text())
    if result["success"] is not True:
        raise RuntimeError(f"CI service startup failed: {result['error']}")


def stop(prefix: str) -> None:
    for service in IMAGES:
        name = f"{prefix}-{service}"
        exists = (
            subprocess.run(
                ["docker", "container", "inspect", name],
                capture_output=True,
                check=False,
            ).returncode
            == 0
        )
        if exists:
            docker("rm", "-f", name)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["start", "stop"])
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--result-file", type=Path)
    parser.add_argument("--tinybird", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"polar-ci-[a-z0-9-]+", args.prefix):
        parser.error(
            "--prefix must start with polar-ci- and contain lowercase letters, digits or hyphens"
        )
    if args.action == "start":
        if args.result_file is None:
            parser.error("start requires --result-file")
        start(args.prefix, args.result_file, args.tinybird)
    else:
        stop(args.prefix)


if __name__ == "__main__":
    main()
