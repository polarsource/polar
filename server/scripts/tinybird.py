import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

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


def get_tinybird_branch() -> str | None:
    if settings.TINYBIRD_BRANCH is None:
        return None
    branch = settings.TINYBIRD_BRANCH.strip()
    return branch or None


def build_tb_command(*args: str) -> list[str]:
    command = ["tb"]
    branch = get_tinybird_branch()
    if branch is not None:
        command.extend(["--branch", branch])
    command.extend(args)
    return command


def get_tinybird_target_label() -> str:
    workspace = settings.TINYBIRD_WORKSPACE
    assert workspace is not None

    branch = get_tinybird_branch()
    if branch is None:
        return f"workspace {workspace}"
    return f"workspace {workspace} branch {branch}"


def run_command(
    args: list[str], cwd: str, *, capture_output: bool = False
) -> str | None:
    print(f"Running: {' '.join(args)}")
    result = subprocess.run(
        args,
        cwd=cwd,
        env=get_tinybird_env(),
        capture_output=capture_output,
        text=True,
    )

    if capture_output:
        if result.stderr:
            print(result.stderr, file=sys.stderr, end="")
    elif result.returncode != 0:
        print(f"Command failed with exit code {result.returncode}")

    if result.returncode != 0:
        if capture_output and result.stdout:
            print(result.stdout, end="")
        sys.exit(result.returncode)

    if capture_output:
        return result.stdout

    return None


def get_tinybird_workspace_name(info: dict[str, Any]) -> str | None:
    cloud = info.get("cloud")
    if not isinstance(cloud, dict):
        return None

    workspace_name = cloud.get("workspace_name")
    if not isinstance(workspace_name, str):
        return None

    normalized_workspace_name = workspace_name.strip()
    return normalized_workspace_name or None


def get_tinybird_branch_names(info: dict[str, Any]) -> list[str]:
    branches = info.get("branches", {}).get("items", [])
    return sorted(
        branch_name
        for branch in branches
        if isinstance(branch, dict)
        for branch_name in [branch.get("name")]
        if isinstance(branch_name, str) and branch_name.strip()
    )


def get_tinybird_info(cwd: str) -> dict[str, Any]:
    output = run_command(
        build_tb_command("--output", "json", "info", "--skip-local"),
        cwd,
        capture_output=True,
    )
    assert output is not None
    try:
        return json.loads(output)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Could not parse Tinybird JSON output: {output}") from exc


def validate_tinybird_target(cwd: str) -> None:
    info = get_tinybird_info(cwd)
    expected_workspace = settings.TINYBIRD_WORKSPACE
    assert expected_workspace is not None

    resolved_workspace = get_tinybird_workspace_name(info)
    if resolved_workspace != expected_workspace:
        raise RuntimeError(
            "Tinybird token resolved to the wrong workspace: "
            f"expected {expected_workspace}, got {resolved_workspace or 'unknown'}"
        )

    branch = get_tinybird_branch()
    branch_names = get_tinybird_branch_names(info)
    current_branch = info.get("branches", {}).get("current") or "main"
    print(
        "Tinybird target info: "
        f"workspace={resolved_workspace} current_branch={current_branch} "
        f"branches={','.join(branch_names) or 'none'}"
    )

    if branch is not None and branch not in branch_names:
        raise RuntimeError(
            f"Tinybird branch {branch} does not exist in workspace {expected_workspace}"
        )


@cli.command()
def deploy() -> None:
    if not is_configured():
        print("Tinybird not configured, skipping deployment")
        return

    tinybird_dir = get_tinybird_dir()
    if not os.path.isdir(tinybird_dir):
        print(f"Tinybird directory not found at {tinybird_dir}, skipping")
        return

    target = get_tinybird_target_label()
    tinybird_dir_path = Path(tinybird_dir).resolve()
    print(f"Using Tinybird directory {tinybird_dir_path}")
    print(f"Validating Tinybird target {target}...")
    validate_tinybird_target(tinybird_dir)

    print(f"Building Tinybird project for {target}...")
    run_command(build_tb_command("build"), cwd=tinybird_dir)

    print(f"Checking deployment to {target}...")
    run_command(build_tb_command("deploy", "--check"), cwd=tinybird_dir)

    print(f"Deploying to {target}...")
    run_command(build_tb_command("deploy"), cwd=tinybird_dir)

    print(f"Tinybird deployment completed successfully for {target}")


if __name__ == "__main__":
    cli()
