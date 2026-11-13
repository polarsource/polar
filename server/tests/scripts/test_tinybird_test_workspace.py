from pathlib import Path

import httpx
import pytest
from pytest_mock import MockerFixture
from typer.testing import CliRunner

from scripts import tinybird_test_workspace as workspace_script

runner = CliRunner()


@pytest.fixture(autouse=True)
def workspace_api(mocker: MockerFixture) -> None:
    mocker.patch.object(
        workspace_script,
        "request",
        return_value=httpx.Response(
            200, json={"user_token": "user-token", "admin_token": "admin-token"}
        ),
    )
    mocker.patch.object(
        workspace_script,
        "create_workspace",
        return_value=("workspace-id", "workspace-token"),
    )
    mocker.patch.object(workspace_script, "deploy_schema")
    mocker.patch.object(workspace_script, "wait_for_ingestion")


class TestMain:
    def test_stdout(self) -> None:
        result = runner.invoke(workspace_script.cli, [])

        assert result.exit_code == 0
        assert result.stdout == "workspace-token\n"

    def test_token_file_is_published_after_readiness(
        self, tmp_path: Path, mocker: MockerFixture
    ) -> None:
        token_file = tmp_path / "tinybird-token"

        def check_unpublished(*args: object) -> None:
            assert not token_file.exists()

        wait_for_ingestion = mocker.patch.object(
            workspace_script, "wait_for_ingestion", side_effect=check_unpublished
        )

        result = runner.invoke(workspace_script.cli, ["--token-file", str(token_file)])

        assert result.exit_code == 0
        wait_for_ingestion.assert_called_once()
        assert token_file.read_text() == "workspace-token"
        assert result.stdout == ""

    def test_preparation_failure_is_published(
        self, tmp_path: Path, mocker: MockerFixture
    ) -> None:
        token_file = tmp_path / "tinybird-token"
        mocker.patch.object(
            workspace_script, "deploy_schema", side_effect=RuntimeError("deploy failed")
        )

        result = runner.invoke(workspace_script.cli, ["--token-file", str(token_file)])

        assert result.exit_code != 0
        assert not token_file.exists()
        assert token_file.with_suffix(".error").read_text() == "RuntimeError"
