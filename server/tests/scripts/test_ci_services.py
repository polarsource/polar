import json
import subprocess
from pathlib import Path

import pytest
from pytest_mock import MockerFixture

from scripts.ci_migrate import migrate
from scripts.ci_migrations import wait_for_migrations
from scripts.ci_services import start, wait_for_services, write_result


class TestServices:
    def test_failed_services_prevent_migrations(
        self, tmp_path: Path, mocker: MockerFixture
    ) -> None:
        services = tmp_path / "services.json"
        migrations = tmp_path / "migrations.json"
        write_result(services, {}, "image pull failed")
        get_config = mocker.patch("scripts.ci_migrate.get_config")

        with pytest.raises(RuntimeError, match="CI service startup failed"):
            migrate(migrations, False, services)

        get_config.assert_not_called()
        with pytest.raises(RuntimeError, match="image pull failed"):
            wait_for_migrations(migrations)

    def test_failed_docker_start_is_published(
        self, tmp_path: Path, mocker: MockerFixture
    ) -> None:
        result = tmp_path / "services.json"
        mocker.patch(
            "scripts.ci_services.start_service",
            side_effect=subprocess.CalledProcessError(125, ["docker", "run"]),
        )

        with pytest.raises(subprocess.CalledProcessError):
            start("polar-ci-failure", result, False)

        assert json.loads(result.read_text())["success"] is False
        with pytest.raises(RuntimeError, match="CI service startup failed"):
            wait_for_services(result)

    def test_missing_service_result_fails(self, tmp_path: Path) -> None:
        with pytest.raises(RuntimeError, match="Timed out waiting for CI services"):
            wait_for_services(tmp_path / "missing.json", timeout=0)
