"""Find and roll back migrations the database got from another branch."""

import re
import subprocess
from dataclasses import dataclass

from shared import ROOT_DIR, SERVER_DIR, run_command

VERSIONS_DIR = "server/migrations/versions"


@dataclass
class Drift:
    revision: str
    branch: str | None
    target: str | None
    paths: dict[str, str]


def unknown_revision(result: subprocess.CompletedProcess | None) -> str | None:
    if result is None:
        return None
    match = re.search(
        r"Can't locate revision identified by '(\w+)'",
        f"{result.stdout}\n{result.stderr}",
    )
    return match.group(1) if match else None


def branch_with_revision(revision: str) -> str | None:
    result = run_command(
        ["git", "log", "--all", "-1", "--format=%S", f"-S{revision}", "--", VERSIONS_DIR],
        cwd=ROOT_DIR,
        capture=True,
    )
    ref = result.stdout.strip() if result and result.returncode == 0 else ""
    return ref.removeprefix("refs/heads/").removeprefix("refs/remotes/") or None


def migrations(ref: str | None) -> dict[str, tuple[str, str]]:
    result = run_command(
        ["git", "grep", "-E", "^(down_)?revision = "]
        + ([ref] if ref else [])
        + ["--", VERSIONS_DIR],
        cwd=ROOT_DIR,
        capture=True,
    )
    return {
        revision: (path, parent or "base")
        for path, revision, parent in re.findall(
            rf"^(?:.*:)?({VERSIONS_DIR}/[^:\n]+):revision = [\"'](\w+)[\"']\n"
            r".*:down_revision = (?:[\"'](\w+)[\"']|None)$",
            result.stdout if result else "",
            re.MULTILINE,
        )
    }


def find_drift(revision: str) -> Drift:
    here = migrations(None)
    if revision in here:
        return Drift(revision, None, here[revision][1], {})
    branch = branch_with_revision(revision)
    if branch is None:
        return Drift(revision, None, None, {})
    there = migrations(branch)
    paths = {}
    target = revision
    while target in there and target not in here:
        path, parent = there[target]
        paths[target] = path
        target = parent
    return Drift(revision, branch, target if target in here else None, paths)


def roll_back(drift: Drift) -> bool:
    written = []
    try:
        for path in drift.paths.values():
            source = run_command(
                ["git", "show", f"{drift.branch}:{path}"], cwd=ROOT_DIR, capture=True
            )
            if source is None or source.returncode != 0:
                return False
            file = ROOT_DIR / path
            with file.open("x") as migration:
                migration.write(source.stdout)
            written.append(file)
        result = run_command(
            ["uv", "run", "alembic", "downgrade", drift.target], cwd=SERVER_DIR
        )
        return bool(result and result.returncode == 0)
    finally:
        for file in written:
            file.unlink()
