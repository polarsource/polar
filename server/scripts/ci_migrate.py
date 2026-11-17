import argparse
from pathlib import Path

from alembic.command import check, upgrade

from scripts.ci_migrations import record_migrations
from scripts.ci_services import wait_for_services
from scripts.db import get_config


def migrate(
    result_file: Path, check_schema: bool, services_result_file: Path | None = None
) -> None:
    try:
        if services_result_file is not None:
            wait_for_services(services_result_file)
        config = get_config()
        upgrade(config, "head")
        if check_schema:
            check(config)
    except Exception as error:
        record_migrations(result_file, error)
        raise
    record_migrations(result_file)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--result-file", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--services-result-file", type=Path)
    args = parser.parse_args()
    migrate(args.result_file, args.check, args.services_result_file)


if __name__ == "__main__":
    main()
