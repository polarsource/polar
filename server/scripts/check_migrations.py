"""Check Alembic heads, new migration filenames, and staged column drops."""

from __future__ import annotations

import argparse
import ast
import re
import subprocess
import sys
from collections.abc import Iterable, Mapping
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

from polar.models import Model

FILENAME_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}-\d{4})_")
VERSIONS_GIT_PATH = "server/migrations/versions"
ENV_GIT_PATH = "server/migrations/env.py"
SERVER_ROOT = Path(__file__).resolve().parents[1]
type Column = tuple[str, str]


def unmapped_columns(source: str) -> set[Column]:
    for node in ast.parse(source).body:
        match node:
            case ast.AnnAssign(target=ast.Name(id="UNMAPPED_COLUMNS"), value=value):
                pass
            case ast.Assign(targets=[ast.Name(id="UNMAPPED_COLUMNS")], value=value):
                pass
            case _:
                continue
        columns = ast.literal_eval(value) if value is not None else None
        if not isinstance(columns, set) or not all(
            isinstance(column, tuple)
            and len(column) == 2
            and all(isinstance(name, str) for name in column)
            for column in columns
        ):
            raise ValueError(
                "UNMAPPED_COLUMNS must be a literal set of (table, column) pairs"
            )
        return columns
    return set()


def dropped_columns(source: str) -> set[Column]:
    columns: set[Column] = set()
    for function in ast.parse(source).body:
        if not isinstance(function, ast.FunctionDef) or function.name != "upgrade":
            continue
        for node in ast.walk(function):
            if not (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr == "drop_column"
            ):
                continue
            if not isinstance(node.func.value, ast.Name) or node.func.value.id != "op":
                raise ValueError(
                    f"line {node.lineno}: use op.drop_column with literal names"
                )
            arguments = dict(zip(("table_name", "column_name"), node.args))
            arguments.update({kw.arg: kw.value for kw in node.keywords if kw.arg})
            schema = arguments.get("schema")
            if schema is not None and not (
                isinstance(schema, ast.Constant) and schema.value is None
            ):
                raise ValueError(
                    f"line {node.lineno}: column drop check requires the default schema"
                )
            if any(kw.arg is None for kw in node.keywords):
                raise ValueError(
                    f"line {node.lineno}: use op.drop_column with literal names"
                )
            names: list[str] = []
            for argument in ("table_name", "column_name"):
                name = arguments.get(argument)
                if not isinstance(name, ast.Constant) or not isinstance(
                    name.value, str
                ):
                    raise ValueError(
                        f"line {node.lineno}: use op.drop_column with literal names"
                    )
                names.append(name.value)
            table, column = names
            columns.add((table, column))
    return columns


def column_drop_errors(
    base_unmapped: set[Column],
    current_unmapped: set[Column],
    mapped: set[Column],
    migrations: Mapping[str, str],
) -> list[str]:
    errors = [
        f"{table}.{column}: UNMAPPED_COLUMNS entry still exists in model metadata. "
        "Remove the model column first; deferred=True is not sufficient."
        for table, column in sorted(current_unmapped & mapped)
    ]
    for filename, source in sorted(migrations.items()):
        try:
            dropped = dropped_columns(source)
        except (SyntaxError, ValueError) as exc:
            errors.append(f"{filename}: {exc}")
            continue
        for table, column in sorted(dropped):
            label = f"{filename}: {table}.{column}"
            if (table, column) not in base_unmapped:
                errors.append(
                    f"{label}: missing from UNMAPPED_COLUMNS on the base commit. "
                    "First remove the model column and add its entry in a separate PR, "
                    "then deploy it before dropping the column."
                )
            if (table, column) in current_unmapped:
                errors.append(
                    f"{label}: remove its UNMAPPED_COLUMNS entry when dropping it."
                )
            if (table, column) in mapped:
                errors.append(
                    f"{label}: dropped column still exists in model metadata."
                )
    return errors


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
    config = Config(str(SERVER_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(SERVER_ROOT / "migrations"))
    return ScriptDirectory.from_config(config)


def git_toplevel() -> Path:
    return Path(
        subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            text=True,
        ).strip()
    )


def current_migration_filenames() -> list[str]:
    versions = SERVER_ROOT / "migrations" / "versions"
    return [path.name for path in versions.glob("*.py")]


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
    except subprocess.CalledProcessError as exc:
        print(f"Could not list migrations at {base}: {exc.stderr or exc}")
        return 1

    head_files = current_migration_filenames()

    try:
        base_env = subprocess.check_output(
            ["git", "-C", str(git_toplevel()), "show", f"{base}:{ENV_GIT_PATH}"],
            text=True,
            stderr=subprocess.PIPE,
        )
        base_unmapped = unmapped_columns(base_env)
        current_unmapped = unmapped_columns(
            (SERVER_ROOT / "migrations" / "env.py").read_text()
        )
    except (subprocess.CalledProcessError, SyntaxError, ValueError) as exc:
        print(f"Could not read UNMAPPED_COLUMNS: {exc}")
        return 1

    errors = column_drop_errors(
        base_unmapped,
        current_unmapped,
        {
            (table.name, column.name)
            for table in Model.metadata.tables.values()
            for column in table.columns
        },
        {
            name: (SERVER_ROOT / "migrations" / "versions" / name).read_text()
            for name in set(head_files) - set(base_files)
        },
    )
    if errors:
        print("Column drop safety check failed:")
        for error in errors:
            print(f"  {error}")
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
