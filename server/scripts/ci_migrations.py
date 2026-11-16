import argparse
import json
import time
from pathlib import Path

from alembic.command import check, upgrade

from scripts.db import get_config


def wait_for_migrations(result_file: Path, timeout: float = 120) -> None:
    deadline = time.monotonic() + timeout
    while not result_file.exists():
        if time.monotonic() >= deadline:
            raise RuntimeError("Timed out waiting for CI database migrations")
        time.sleep(0.05)
    result = json.loads(result_file.read_text())
    if result["success"] is not True:
        raise RuntimeError(f"CI database migrations failed: {result['error']}")


def migrate(result_file: Path, check_schema: bool) -> None:
    temporary = result_file.with_suffix(".tmp")
    try:
        config = get_config()
        upgrade(config, "head")
        if check_schema:
            check(config)
    except Exception as error:
        temporary.write_text(json.dumps({"success": False, "error": str(error)}))
        temporary.replace(result_file)
        raise
    temporary.write_text(json.dumps({"success": True}))
    temporary.replace(result_file)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["migrate", "wait"])
    parser.add_argument("--result-file", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.action == "wait":
        wait_for_migrations(args.result_file)
    else:
        migrate(args.result_file, args.check)


if __name__ == "__main__":
    main()
