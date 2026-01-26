import os
import subprocess
import sys

import typer

from polar.config import settings

cli = typer.Typer()


def is_configured() -> bool:
    return bool(settings.TINYBIRD_API_TOKEN and settings.TINYBIRD_WORKSPACE)


def get_tinybird_dir() -> str:
    return os.path.join(os.path.dirname(__file__), "../tinybird")


def get_tinybird_env() -> dict[str, str]:
    env = os.environ.copy()
    if settings.TINYBIRD_API_TOKEN:
        env["TB_ADMIN_TOKEN"] = settings.TINYBIRD_API_TOKEN
    if settings.TINYBIRD_API_URL:
        env["TB_HOST"] = settings.TINYBIRD_API_URL
    return env


def run_command(args: list[str], cwd: str) -> None:
    print(f"Running: {' '.join(args)}")
    result = subprocess.run(args, cwd=cwd, env=get_tinybird_env())
    if result.returncode != 0:
        print(f"Command failed with exit code {result.returncode}")
        sys.exit(result.returncode)


@cli.command()
def deploy() -> None:
    if not is_configured():
        print("Tinybird not configured, skipping deployment")
        return

    tinybird_dir = get_tinybird_dir()
    if not os.path.isdir(tinybird_dir):
        print(f"Tinybird directory not found at {tinybird_dir}, skipping")
        return

    workspace = settings.TINYBIRD_WORKSPACE
    assert workspace is not None

    print("Validating Tinybird schema...")
    run_command(["tb", "build"], cwd=tinybird_dir)

    print(f"Checking deployment to workspace {workspace}...")
    run_command(
        ["tb", "deploy", "--check", "--workspace", workspace],
        cwd=tinybird_dir,
    )

    print(f"Deploying to workspace {workspace}...")
    run_command(
        ["tb", "deploy", "--workspace", workspace],
        cwd=tinybird_dir,
    )

    print("Tinybird deployment completed successfully")


if __name__ == "__main__":
    cli()
