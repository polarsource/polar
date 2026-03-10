from pathlib import Path

import pytest
from typer.testing import CliRunner

import scripts.tinybird as tinybird_script
from polar.config import settings
from scripts.tinybird import build_tb_command, cli, validate_tinybird_target

runner = CliRunner()


class TestBuildTBCommand:
    def test_adds_branch_when_configured(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(settings, "TINYBIRD_BRANCH", "preview_pr_123")

        assert build_tb_command("deploy", "--check") == [
            "tb",
            "--branch",
            "preview_pr_123",
            "deploy",
            "--check",
        ]

    def test_omits_branch_when_not_configured(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(settings, "TINYBIRD_BRANCH", None)

        assert build_tb_command("deploy", "--check") == [
            "tb",
            "deploy",
            "--check",
        ]


class TestValidateTinybirdTarget:
    def test_fails_for_wrong_workspace(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(settings, "TINYBIRD_WORKSPACE", "polar")
        monkeypatch.setattr(settings, "TINYBIRD_BRANCH", None)
        monkeypatch.setattr(
            tinybird_script,
            "get_tinybird_info",
            lambda cwd: {
                "cloud": {"workspace_name": "other"},
                "branches": {"current": "main", "items": []},
            },
        )

        with pytest.raises(
            RuntimeError,
            match="expected polar, got other",
        ):
            validate_tinybird_target(".")

    def test_fails_when_branch_is_missing(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(settings, "TINYBIRD_WORKSPACE", "polar")
        monkeypatch.setattr(settings, "TINYBIRD_BRANCH", "preview_pr_123")
        monkeypatch.setattr(
            tinybird_script,
            "get_tinybird_info",
            lambda cwd: {
                "cloud": {"workspace_name": "polar"},
                "branches": {"current": "main", "items": []},
            },
        )

        with pytest.raises(
            RuntimeError,
            match="Tinybird branch preview_pr_123 does not exist",
        ):
            validate_tinybird_target(".")


class TestTinybirdCLI:
    def test_deploy_skips_when_not_configured(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(settings, "TINYBIRD_API_TOKEN", None)
        monkeypatch.setattr(settings, "TINYBIRD_WORKSPACE", None)

        result = runner.invoke(cli, [])

        assert result.exit_code == 0
        assert "Tinybird not configured, skipping deployment" in result.stdout

    def test_deploy_runs_build_check_and_deploy_for_branch(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        captured_commands: list[tuple[list[str], str, bool]] = []
        validate_calls: list[str] = []

        monkeypatch.setattr(settings, "TINYBIRD_API_TOKEN", "tb-admin-token")
        monkeypatch.setattr(settings, "TINYBIRD_WORKSPACE", "polar")
        monkeypatch.setattr(settings, "TINYBIRD_BRANCH", "preview_pr_123")
        monkeypatch.setattr(settings, "TINYBIRD_API_URL", "https://api.tinybird.co")
        monkeypatch.setattr(
            tinybird_script,
            "get_tinybird_dir",
            lambda: str(tmp_path),
        )
        monkeypatch.setattr(
            tinybird_script,
            "validate_tinybird_target",
            lambda cwd: validate_calls.append(cwd),
        )

        def fake_run_command(
            args: list[str],
            cwd: str,
            *,
            capture_output: bool = False,
        ) -> str | None:
            captured_commands.append((args, cwd, capture_output))
            return None

        monkeypatch.setattr(tinybird_script, "run_command", fake_run_command)

        result = runner.invoke(cli, [])

        assert result.exit_code == 0
        assert validate_calls == [str(tmp_path)]
        assert captured_commands == [
            (
                ["tb", "--branch", "preview_pr_123", "build"],
                str(tmp_path),
                False,
            ),
            (
                ["tb", "--branch", "preview_pr_123", "deploy", "--check"],
                str(tmp_path),
                False,
            ),
            (
                ["tb", "--branch", "preview_pr_123", "deploy"],
                str(tmp_path),
                False,
            ),
        ]
        assert "Deploying to workspace polar branch preview_pr_123..." in result.stdout
