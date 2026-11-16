from pathlib import Path
from unittest.mock import Mock

import pytest
from alembic.config import Config
from alembic.util.exc import CommandError

from scripts.ci_migrate import migrate
from scripts.ci_migrations import record_migrations, wait_for_migrations
from tests.fixtures.database import clone_template_database


def test_failed_migrations_prevent_every_template_clone(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    result_file = tmp_path / "result.json"
    record_migrations(result_file, RuntimeError("migration failed"))
    monkeypatch.setenv("POLAR_TEST_MIGRATION_RESULT", str(result_file))
    create_database = Mock()
    monkeypatch.setattr("tests.fixtures.database.create_database", create_database)

    with pytest.raises(RuntimeError, match="migration failed"):
        clone_template_database("unused")

    create_database.assert_not_called()


def test_migration_error_is_published_to_waiters(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    result_file = tmp_path / "result.json"
    monkeypatch.setattr("scripts.ci_migrate.get_config", lambda: Config())

    with pytest.raises(CommandError, match="script_location"):
        migrate(result_file, check_schema=False)

    with pytest.raises(RuntimeError, match="script_location"):
        wait_for_migrations(result_file)


def test_missing_migration_result_fails(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="Timed out"):
        wait_for_migrations(tmp_path / "missing.json", timeout=0)
