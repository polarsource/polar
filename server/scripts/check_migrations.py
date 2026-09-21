"""Fail if new Alembic migrations aren't a single head with a later filename."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections.abc import Iterable
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

FILENAME_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}-\d{4})_")
VERSIONS_GIT_PATH = "server/migrations/versions"


def filename_stamp(name: str) -> str | None:
    match = FILENAME_RE.match(name)
    return match.group(1) if match else None


def stale_new_migrations(
    base_files: Iterable[str], head_files: Iterable[str]
) -> tuple[str | None, list[str]]:
    base_names = list(base_files)
    new_files = sorted(set(head_files) - set(base_names))
    if not new_files:
        return None, []

    base_stamps = [stamp for name in base_names if (stamp := filename_stamp(name))]
    latest_base = max(base_stamps) if base_stamps else None
    if latest_base is None:
        return None, new_files

    stale = [
        name
        for name in new_files
        if (stamp := filename_stamp(name)) is None or stamp <= latest_base
    ]
    return latest_base, stale


def script_directory() -> ScriptDirectory:
    server_root = Path(__file__).resolve().parents[1]
    config = Config(str(server_root / "alembic.ini"))
    config.set_main_option("script_location", str(server_root / "migrations"))
    return ScriptDirectory.from_config(config)


def git_toplevel() -> Path:
    return Path(
        subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            text=True,
        ).strip()
    )


def git_migration_filenames(ref: str) -> list[str]:
    result = subprocess.run(
        [
            "git",
            "-C",
            str(git_toplevel()),
            "ls-tree",
            "-r",
            "--name-only",
            ref,
            "--",
            VERSIONS_GIT_PATH,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return [
        Path(line).name for line in result.stdout.splitlines() if line.endswith(".py")
    ]


def check(base: str) -> int:
    heads = script_directory().get_heads()
    if len(heads) != 1:
        print("Multiple Alembic heads:")
        for head in heads:
            print(f"  {head}")
        print(
            "Rebase onto the target branch, run `uv run task db_reparent`, "
            "then rename the new migration so its filename datetime is after "
            "the latest one on the base branch."
        )
        return 1

    try:
        base_files = git_migration_filenames(base)
        head_files = git_migration_filenames("HEAD")
    except subprocess.CalledProcessError as exc:
        print(f"Could not list migrations at {base}: {exc.stderr or exc}")
        return 1

    latest_base, stale = stale_new_migrations(base_files, head_files)
    new_count = len(set(head_files) - set(base_files))
    if not stale:
        if new_count:
            print(f"OK: {new_count} new migration(s) after {latest_base}, single head.")
        else:
            print("OK: no new migrations, single head.")
        return 0

    latest_label = latest_base or "the latest base migration"
    print(f"New migration filename must be after {latest_label}:")
    for name in stale:
        print(f"  {name}")
    print(
        "Alembic names files YYYY-MM-DD-HHMM_slug.py. Rename after rebasing "
        "so the datetime is after the latest migration on the base branch."
    )
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base",
        default="main",
        help="git ref of the base branch (default: main)",
    )
    args = parser.parse_args(argv)
    return check(args.base)


if __name__ == "__main__":
    sys.exit(main())
