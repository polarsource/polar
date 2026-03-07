import json
from io import StringIO
from pathlib import Path

import pytest
from typer.testing import CliRunner

import scripts.preview as preview_script
from scripts.preview import (
    ChangedSurfaces,
    PreviewPostgresAdminConfig,
    PreviewPostgresProvisionResult,
    PreviewPostgresTeardownResult,
    PreviewResult,
    build_preview_database_name,
    build_preview_role_name,
    build_preview_url,
    cli,
    plan_create_or_update,
    render_result,
    resolve_preview_id,
    sanitize_preview_label,
    write_github_output,
)

runner = CliRunner()


class FakeCursor:
    def __init__(
        self,
        *,
        role_exists: bool = False,
        database_exists: bool = False,
    ) -> None:
        self.role_exists = role_exists
        self.database_exists = database_exists
        self.executed: list[tuple[str, tuple[object, ...] | None]] = []
        self.last_query: str | None = None

    def execute(self, query: str, params: tuple[object, ...] | None = None) -> None:
        self.executed.append((query, params))
        self.last_query = query

    def fetchone(self) -> tuple[int] | None:
        if self.last_query == "SELECT 1 FROM pg_roles WHERE rolname = %s":
            return (1,) if self.role_exists else None
        if self.last_query == "SELECT 1 FROM pg_database WHERE datname = %s":
            return (1,) if self.database_exists else None
        raise AssertionError(f"Unexpected fetchone call for query: {self.last_query}")

    def close(self) -> None:
        return None


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor
        self.autocommit = False
        self.closed = False

    def cursor(self) -> FakeCursor:
        return self._cursor

    def close(self) -> None:
        self.closed = True


class TestSanitizePreviewLabel:
    def test_sanitizes_branch_names(self) -> None:
        assert sanitize_preview_label("Feature/Add Preview Workflow") == (
            "feature-add-preview-workflow"
        )

    def test_raises_when_value_has_no_usable_characters(self) -> None:
        with pytest.raises(ValueError, match="Could not derive a preview identifier"):
            sanitize_preview_label("___")


class TestResolvePreviewID:
    def test_prefers_explicit_preview_id(self) -> None:
        assert (
            resolve_preview_id("Preview_Custom", pr_number=42, branch="feature/test")
            == "preview-custom"
        )

    def test_falls_back_to_pr_number(self) -> None:
        assert resolve_preview_id(None, pr_number=42, branch="feature/test") == "pr-42"

    def test_falls_back_to_branch(self) -> None:
        assert (
            resolve_preview_id(None, pr_number=None, branch="feature/test-preview")
            == "branch-feature-test-preview"
        )


class TestPreviewPostgresIdentifiers:
    def test_builds_database_name(self) -> None:
        assert build_preview_database_name("pr-123") == "preview_pr_123"

    def test_builds_role_name(self) -> None:
        assert build_preview_role_name("pr-123") == "preview_pr_123_app"


class TestPlanCreateOrUpdate:
    def test_includes_only_changed_surfaces(self) -> None:
        steps = plan_create_or_update(
            ChangedSurfaces(
                backend=True,
                frontend=False,
                migrations=True,
                tinybird=False,
            )
        )

        assert steps == [
            "materialize_source",
            "ensure_preview_database",
            "ensure_tinybird_workspace",
            "ensure_preview_secrets",
            "run_database_migrations",
            "update_backend_services",
            "ensure_frontend_service",
            "run_health_checks",
        ]


class TestWriteGithubOutput:
    def test_writes_expected_keys(self) -> None:
        result = PreviewResult(
            action="destroy",
            preview_id="preview-custom",
            preview_url=build_preview_url("preview-custom"),
            status="planned",
            branch=None,
            sha=None,
            changed_surfaces=ChangedSurfaces(),
            steps=["drop_preview_database"],
            dry_run=True,
        )
        output = StringIO()

        write_github_output(
            Path("/tmp/preview-output"),
            result=result,
            stream=output,
        )

        assert output.getvalue().splitlines() == [
            "preview_id=preview-custom",
            f"preview_url={build_preview_url('preview-custom')}",
            "preview_status=planned",
            f"result_json={render_result(result)}",
        ]


class TestPreviewCLI:
    def test_create_or_update_emits_json_and_github_output(
        self, tmp_path: Path
    ) -> None:
        github_output = tmp_path / "github-output.txt"

        result = runner.invoke(
            cli,
            [
                "create-or-update",
                "--pr-number",
                "123",
                "--branch",
                "feature/preview-workflow",
                "--sha",
                "abc123",
                "--changed-backend",
                "--changed-migrations",
                "--dry-run",
                "--github-output",
                str(github_output),
            ],
        )

        assert result.exit_code == 0

        payload = json.loads(result.stdout)
        assert payload == {
            "action": "create-or-update",
            "branch": "feature/preview-workflow",
            "changed_surfaces": {
                "backend": True,
                "frontend": False,
                "migrations": True,
                "tinybird": False,
            },
            "dry_run": True,
            "preview_id": "pr-123",
            "preview_url": build_preview_url("pr-123"),
            "sha": "abc123",
            "status": "planned",
            "steps": [
                "materialize_source",
                "ensure_preview_database",
                "ensure_tinybird_workspace",
                "ensure_preview_secrets",
                "run_database_migrations",
                "update_backend_services",
                "ensure_frontend_service",
                "run_health_checks",
            ],
        }

        assert github_output.read_text().splitlines() == [
            "preview_id=pr-123",
            f"preview_url={build_preview_url('pr-123')}",
            "preview_status=planned",
            f"result_json={json.dumps(payload, separators=(',', ':'), sort_keys=True)}",
        ]

    def test_postgres_provision_creates_database_and_user(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        github_output = tmp_path / "github-output.txt"
        cursor = FakeCursor()
        connection = FakeConnection(cursor)
        captured_admin_dsns: list[str] = []

        def fake_connect(
            config: preview_script.PreviewPostgresAdminConfig,
        ) -> FakeConnection:
            captured_admin_dsns.append(config.admin_dsn)
            connection.autocommit = True
            return connection

        monkeypatch.setenv(
            "PREVIEW_POSTGRES_ADMIN_DSN",
            "postgresql://admin:secret@db.internal:5432/postgres",
        )
        monkeypatch.setattr(
            preview_script, "generate_preview_password", lambda: "db-pass"
        )
        monkeypatch.setattr(
            preview_script, "connect_preview_postgres_admin", fake_connect
        )

        result = runner.invoke(
            cli,
            [
                "postgres-provision",
                "--preview-id",
                "pr-123",
                "--github-output",
                str(github_output),
            ],
        )

        assert result.exit_code == 0
        assert captured_admin_dsns == [
            "postgresql://admin:secret@db.internal:5432/postgres"
        ]
        assert connection.autocommit is True
        assert connection.closed is True
        assert cursor.executed == [
            ("SELECT 1 FROM pg_roles WHERE rolname = %s", ("preview_pr_123_app",)),
            ("SELECT 1 FROM pg_database WHERE datname = %s", ("preview_pr_123",)),
            ("CREATE ROLE preview_pr_123_app LOGIN PASSWORD %s", ("db-pass",)),
            ("CREATE DATABASE preview_pr_123 WITH OWNER preview_pr_123_app", None),
            ("REVOKE ALL ON DATABASE preview_pr_123 FROM PUBLIC", None),
        ]

        payload = json.loads(result.stdout)
        assert payload == {
            "database_name": "preview_pr_123",
            "env": {
                "POLAR_POSTGRES_DATABASE": "preview_pr_123",
                "POLAR_POSTGRES_HOST": "db.internal",
                "POLAR_POSTGRES_PORT": "5432",
                "POLAR_POSTGRES_PWD": "db-pass",
                "POLAR_POSTGRES_USER": "preview_pr_123_app",
            },
            "host": "db.internal",
            "password": "db-pass",
            "port": 5432,
            "preview_id": "pr-123",
            "role_name": "preview_pr_123_app",
        }

        assert github_output.read_text().splitlines() == [
            "preview_postgres_database=preview_pr_123",
            "preview_postgres_user=preview_pr_123_app",
            "preview_postgres_password=db-pass",
            'preview_postgres_env_json={"POLAR_POSTGRES_DATABASE":"preview_pr_123","POLAR_POSTGRES_HOST":"db.internal","POLAR_POSTGRES_PORT":"5432","POLAR_POSTGRES_PWD":"db-pass","POLAR_POSTGRES_USER":"preview_pr_123_app"}',
        ]

    def test_postgres_provision_reuses_existing_database_and_user(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        github_output = tmp_path / "github-output.txt"
        cursor = FakeCursor(role_exists=True, database_exists=True)
        connection = FakeConnection(cursor)
        captured_admin_dsns: list[str] = []

        def fake_connect(
            config: preview_script.PreviewPostgresAdminConfig,
        ) -> FakeConnection:
            captured_admin_dsns.append(config.admin_dsn)
            connection.autocommit = True
            return connection

        monkeypatch.setenv(
            "PREVIEW_POSTGRES_ADMIN_DSN",
            "postgresql://admin:secret@db.internal:5432/postgres",
        )
        monkeypatch.setattr(
            preview_script, "generate_preview_password", lambda: "rotated-pass"
        )
        monkeypatch.setattr(
            preview_script, "connect_preview_postgres_admin", fake_connect
        )

        result = runner.invoke(
            cli,
            [
                "postgres-provision",
                "--preview-id",
                "pr-123",
                "--github-output",
                str(github_output),
            ],
        )

        assert result.exit_code == 0
        assert captured_admin_dsns == [
            "postgresql://admin:secret@db.internal:5432/postgres"
        ]
        assert connection.autocommit is True
        assert connection.closed is True
        assert cursor.executed == [
            ("SELECT 1 FROM pg_roles WHERE rolname = %s", ("preview_pr_123_app",)),
            ("SELECT 1 FROM pg_database WHERE datname = %s", ("preview_pr_123",)),
            ("REVOKE ALL ON DATABASE preview_pr_123 FROM PUBLIC", None),
            ("ALTER ROLE preview_pr_123_app WITH PASSWORD %s", ("rotated-pass",)),
        ]

        payload = json.loads(result.stdout)
        assert payload == {
            "database_name": "preview_pr_123",
            "env": {
                "POLAR_POSTGRES_DATABASE": "preview_pr_123",
                "POLAR_POSTGRES_HOST": "db.internal",
                "POLAR_POSTGRES_PORT": "5432",
                "POLAR_POSTGRES_PWD": "rotated-pass",
                "POLAR_POSTGRES_USER": "preview_pr_123_app",
            },
            "host": "db.internal",
            "password": "rotated-pass",
            "port": 5432,
            "preview_id": "pr-123",
            "role_name": "preview_pr_123_app",
        }

        assert github_output.read_text().splitlines() == [
            "preview_postgres_database=preview_pr_123",
            "preview_postgres_user=preview_pr_123_app",
            "preview_postgres_password=rotated-pass",
            'preview_postgres_env_json={"POLAR_POSTGRES_DATABASE":"preview_pr_123","POLAR_POSTGRES_HOST":"db.internal","POLAR_POSTGRES_PORT":"5432","POLAR_POSTGRES_PWD":"rotated-pass","POLAR_POSTGRES_USER":"preview_pr_123_app"}',
        ]

    def test_postgres_teardown_drops_database_and_user(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        github_output = tmp_path / "github-output.txt"
        cursor = FakeCursor(role_exists=True, database_exists=True)
        connection = FakeConnection(cursor)
        captured_admin_dsns: list[str] = []

        def fake_connect(
            config: preview_script.PreviewPostgresAdminConfig,
        ) -> FakeConnection:
            captured_admin_dsns.append(config.admin_dsn)
            connection.autocommit = True
            return connection

        monkeypatch.setenv(
            "PREVIEW_POSTGRES_ADMIN_DSN",
            "postgresql://admin:secret@db.internal:5432/postgres",
        )
        monkeypatch.setattr(
            preview_script, "connect_preview_postgres_admin", fake_connect
        )

        result = runner.invoke(
            cli,
            [
                "postgres-teardown",
                "--preview-id",
                "pr-123",
                "--github-output",
                str(github_output),
            ],
        )

        assert result.exit_code == 0
        assert captured_admin_dsns == [
            "postgresql://admin:secret@db.internal:5432/postgres"
        ]
        assert connection.autocommit is True
        assert connection.closed is True
        assert cursor.executed == [
            ("SELECT 1 FROM pg_database WHERE datname = %s", ("preview_pr_123",)),
            ("SELECT 1 FROM pg_roles WHERE rolname = %s", ("preview_pr_123_app",)),
            (
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = %s AND pid <> pg_backend_pid()",
                ("preview_pr_123",),
            ),
            ("DROP DATABASE preview_pr_123", None),
            ("DROP ROLE preview_pr_123_app", None),
        ]

        payload = json.loads(result.stdout)
        assert payload == {
            "database_existed": True,
            "database_name": "preview_pr_123",
            "preview_id": "pr-123",
            "role_existed": True,
            "role_name": "preview_pr_123_app",
        }

        assert github_output.read_text().splitlines() == [
            "preview_postgres_database=preview_pr_123",
            "preview_postgres_user=preview_pr_123_app",
            "preview_postgres_database_existed=true",
            "preview_postgres_role_existed=true",
        ]

    def test_create_or_update_non_dry_run_provisions_postgres(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        github_output = tmp_path / "github-output.txt"
        captured_preview_ids: list[str] = []

        def fake_load_config() -> PreviewPostgresAdminConfig:
            return PreviewPostgresAdminConfig(
                admin_dsn="postgresql://admin:secret@db.internal:5432/postgres",
                app_host="db.internal",
                app_port=5432,
                template_database=None,
            )

        def fake_provision(
            preview_id: str,
            *,
            config: PreviewPostgresAdminConfig,
        ) -> PreviewPostgresProvisionResult:
            captured_preview_ids.append(preview_id)
            assert config == fake_load_config()
            return PreviewPostgresProvisionResult(
                preview_id=preview_id,
                database_name="preview_pr_123",
                role_name="preview_pr_123_app",
                host="db.internal",
                port=5432,
                password="db-pass",
                env={
                    "POLAR_POSTGRES_DATABASE": "preview_pr_123",
                    "POLAR_POSTGRES_HOST": "db.internal",
                    "POLAR_POSTGRES_PORT": "5432",
                    "POLAR_POSTGRES_PWD": "db-pass",
                    "POLAR_POSTGRES_USER": "preview_pr_123_app",
                },
            )

        monkeypatch.setattr(
            preview_script, "load_preview_postgres_admin_config", fake_load_config
        )
        monkeypatch.setattr(
            preview_script, "provision_preview_postgres", fake_provision
        )

        result = runner.invoke(
            cli,
            [
                "create-or-update",
                "--pr-number",
                "123",
                "--branch",
                "feature/preview-workflow",
                "--sha",
                "abc123",
                "--changed-backend",
                "--github-output",
                str(github_output),
            ],
        )

        assert result.exit_code == 0
        assert captured_preview_ids == ["pr-123"]

        payload = json.loads(result.stdout)
        assert payload == {
            "action": "create-or-update",
            "branch": "feature/preview-workflow",
            "changed_surfaces": {
                "backend": True,
                "frontend": False,
                "migrations": False,
                "tinybird": False,
            },
            "dry_run": False,
            "preview_id": "pr-123",
            "preview_url": build_preview_url("pr-123"),
            "sha": "abc123",
            "status": "database-ready",
            "steps": [
                "materialize_source",
                "ensure_preview_database",
                "ensure_tinybird_workspace",
                "ensure_preview_secrets",
                "update_backend_services",
                "ensure_frontend_service",
                "run_health_checks",
            ],
        }

        assert github_output.read_text().splitlines() == [
            "preview_id=pr-123",
            f"preview_url={build_preview_url('pr-123')}",
            "preview_status=database-ready",
            f"result_json={json.dumps(payload, separators=(',', ':'), sort_keys=True)}",
            "preview_postgres_database=preview_pr_123",
            "preview_postgres_user=preview_pr_123_app",
            "preview_postgres_password=db-pass",
            'preview_postgres_env_json={"POLAR_POSTGRES_DATABASE":"preview_pr_123","POLAR_POSTGRES_HOST":"db.internal","POLAR_POSTGRES_PORT":"5432","POLAR_POSTGRES_PWD":"db-pass","POLAR_POSTGRES_USER":"preview_pr_123_app"}',
        ]

    def test_destroy_non_dry_run_tears_down_postgres(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        github_output = tmp_path / "github-output.txt"
        captured_preview_ids: list[str] = []

        def fake_load_config() -> PreviewPostgresAdminConfig:
            return PreviewPostgresAdminConfig(
                admin_dsn="postgresql://admin:secret@db.internal:5432/postgres",
                app_host="db.internal",
                app_port=5432,
                template_database=None,
            )

        def fake_teardown(
            preview_id: str,
            *,
            config: PreviewPostgresAdminConfig,
        ) -> PreviewPostgresTeardownResult:
            captured_preview_ids.append(preview_id)
            assert config == fake_load_config()
            return PreviewPostgresTeardownResult(
                preview_id=preview_id,
                database_name="preview_pr_123",
                database_existed=True,
                role_name="preview_pr_123_app",
                role_existed=True,
            )

        monkeypatch.setattr(
            preview_script, "load_preview_postgres_admin_config", fake_load_config
        )
        monkeypatch.setattr(preview_script, "teardown_preview_postgres", fake_teardown)

        result = runner.invoke(
            cli,
            [
                "destroy",
                "--preview-id",
                "pr-123",
                "--github-output",
                str(github_output),
            ],
        )

        assert result.exit_code == 0
        assert captured_preview_ids == ["pr-123"]

        payload = json.loads(result.stdout)
        assert payload == {
            "action": "destroy",
            "branch": None,
            "changed_surfaces": {
                "backend": False,
                "frontend": False,
                "migrations": False,
                "tinybird": False,
            },
            "dry_run": False,
            "preview_id": "pr-123",
            "preview_url": build_preview_url("pr-123"),
            "sha": None,
            "status": "database-destroyed",
            "steps": [
                "disable_preview_routing",
                "stop_preview_services",
                "drop_preview_database",
                "delete_tinybird_workspace",
                "revoke_preview_credentials",
                "delete_preview_runtime",
            ],
        }

        assert github_output.read_text().splitlines() == [
            "preview_id=pr-123",
            f"preview_url={build_preview_url('pr-123')}",
            "preview_status=database-destroyed",
            f"result_json={json.dumps(payload, separators=(',', ':'), sort_keys=True)}",
            "preview_postgres_database=preview_pr_123",
            "preview_postgres_user=preview_pr_123_app",
            "preview_postgres_database_existed=true",
            "preview_postgres_role_existed=true",
        ]
