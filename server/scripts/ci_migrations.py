import argparse
import json
import time
from pathlib import Path


def record_migrations(result_file: Path, error: Exception | None = None) -> None:
    temporary = result_file.with_suffix(".tmp")
    result = {"success": error is None, "error": str(error) if error else None}
    temporary.write_text(json.dumps(result))
    temporary.replace(result_file)


def wait_for_migrations(result_file: Path, timeout: float = 120) -> None:
    deadline = time.monotonic() + timeout
    while not result_file.exists():
        if time.monotonic() >= deadline:
            raise RuntimeError("Timed out waiting for CI database migrations")
        time.sleep(0.05)
    result = json.loads(result_file.read_text())
    if result["success"] is not True:
        raise RuntimeError(f"CI database migrations failed: {result['error']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--result-file", required=True, type=Path)
    args = parser.parse_args()
    wait_for_migrations(args.result_file)


if __name__ == "__main__":
    main()
