import subprocess
from collections.abc import Sequence
from pathlib import Path

import pytest
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from scripts import check_migrations
from scripts.check_migrations import stale_new_migrations


def test_stale_when_rebased_without_rename() -> None:
    latest, stale = stale_new_migrations(
        ["2026-09-21-1131_head.py"],
        ["2026-09-21-1131_head.py", "2026-09-10-1200_feature.py"],
    )
    assert latest == "2026-09-21-1131"
    assert stale == ["2026-09-10-1200_feature.py"]


def test_fails_on_multiple_heads(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    class FakeScript:
        def get_heads(self) -> Sequence[str]:
            return ["aaa", "bbb"]

    monkeypatch.setattr(check_migrations, "script_directory", lambda: FakeScript())

    assert check_migrations.check("main") == 1
    assert "Multiple Alembic heads" in capsys.readouterr().out


class TestUnmappedColumns:
    @pytest.mark.parametrize(
        ("source", "expected"),
        [
            ("", set()),
            ("UNMAPPED_COLUMNS: set[tuple[str, str]] = set()", set()),
            ('UNMAPPED_COLUMNS = {("events", "sequence")}', {("events", "sequence")}),
        ],
    )
    def test_reads_without_executing_env(
        self, source: str, expected: set[tuple[str, str]]
    ) -> None:
        assert (
            check_migrations.unmapped_columns(
                source + '\nraise RuntimeError("env ran")'
            )
            == expected
        )

    @pytest.mark.parametrize(
        "source",
        [
            "UNMAPPED_COLUMNS = get_columns()",
            'UNMAPPED_COLUMNS = {"events.sequence"}',
        ],
    )
    def test_rejects_unreadable_entries(self, source: str) -> None:
        with pytest.raises(ValueError, match="malformed node|UNMAPPED_COLUMNS"):
            check_migrations.unmapped_columns(source)


class TestDroppedColumns:
    @pytest.mark.parametrize(
        "operation",
        [
            'op.drop_column("events", "sequence")',
            'op.drop_column(table_name="events", column_name="sequence")',
            'op.drop_column("events", column_name="sequence", schema=None)',
        ],
    )
    def test_finds_conditional_upgrade_drops_only(self, operation: str) -> None:
        source = (
            f"def upgrade():\n    if column_exists:\n        {operation}\n"
            'def downgrade():\n    op.drop_column("events", "other")\n'
        )
        assert check_migrations.dropped_columns(source) == {("events", "sequence")}

    @pytest.mark.parametrize(
        "operation",
        [
            'op.drop_column(TABLE, "sequence")',
            'batch_op.drop_column("sequence")',
            'op.drop_column("events", "sequence", **options)',
            'op.drop_column("events", "sequence", schema="other")',
        ],
    )
    def test_rejects_unresolved_drops(self, operation: str) -> None:
        with pytest.raises(ValueError, match="line 2"):
            check_migrations.dropped_columns(f"def upgrade():\n    {operation}\n")


class TestColumnDropErrors:
    @pytest.mark.parametrize(
        ("base_unmapped", "current_unmapped", "mapped", "expected"),
        [
            (set(), set(), set(), "missing from UNMAPPED_COLUMNS on the base commit"),
            (
                set(),
                {("events", "sequence")},
                set(),
                "missing from UNMAPPED_COLUMNS on the base commit",
            ),
            (
                {("events", "sequence")},
                {("events", "sequence")},
                set(),
                "remove its UNMAPPED_COLUMNS entry",
            ),
            (
                {("events", "sequence")},
                set(),
                {("events", "sequence")},
                "dropped column still exists in model metadata",
            ),
            ({("events", "sequence")}, set(), set(), None),
        ],
    )
    def test_drop_requires_prior_unmapping(
        self,
        base_unmapped: set[tuple[str, str]],
        current_unmapped: set[tuple[str, str]],
        mapped: set[tuple[str, str]],
        expected: str | None,
    ) -> None:
        errors = check_migrations.column_drop_errors(
            base_unmapped,
            current_unmapped,
            mapped,
            {"drop.py": 'def upgrade():\n    op.drop_column("events", "sequence")\n'},
        )
        if expected is None:
            assert errors == []
        else:
            assert expected in "\n".join(errors)


class TestColumnDropCheck:
    def test_two_pr_sequence(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        server = tmp_path / "server"
        versions = server / "migrations" / "versions"
        versions.mkdir(parents=True)
        env = server / "migrations" / "env.py"
        env.write_text("UNMAPPED_COLUMNS = set()\n")
        (server / "alembic.ini").write_text("[alembic]\n")
        (versions / "2026-10-01-1200_initial.py").write_text(
            'revision = "initial"\ndown_revision = None\n'
            'def downgrade():\n    op.drop_column("events", "sequence")\n'
        )
        monkeypatch.setattr(check_migrations, "SERVER_ROOT", server)
        monkeypatch.setattr(check_migrations, "git_toplevel", lambda: tmp_path)
        subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
        subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
        commit = [
            "git",
            "-c",
            "user.name=Test",
            "-c",
            "user.email=test@example.com",
            "-c",
            "core.hooksPath=/dev/null",
            "commit",
            "--no-gpg-sign",
            "-qm",
            "base",
        ]
        subprocess.run(commit, cwd=tmp_path, check=True)

        env.write_text('UNMAPPED_COLUMNS = {("events", "sequence")}\n')
        assert check_migrations.check("HEAD") == 0

        drop = versions / "2026-10-02-1200_drop.py"
        drop.write_text(
            'revision = "drop"\ndown_revision = "initial"\n'
            'def upgrade():\n    op.drop_column("events", "sequence")\n'
        )
        assert check_migrations.check("HEAD") == 1
        assert (
            "missing from UNMAPPED_COLUMNS on the base commit"
            in capsys.readouterr().out
        )

        subprocess.run(
            ["git", "add", "server/migrations/env.py"], cwd=tmp_path, check=True
        )
        subprocess.run(commit, cwd=tmp_path, check=True)
        env.write_text("UNMAPPED_COLUMNS = set()\n")
        assert check_migrations.check("HEAD") == 0

    def test_allowlist_rejects_deferred_model_column_without_migration(
        self,
    ) -> None:
        class Base(DeclarativeBase):
            pass

        class Event(Base):
            __tablename__ = "events"
            id: Mapped[int] = mapped_column(primary_key=True)
            sequence: Mapped[int | None] = mapped_column(deferred=True)

        errors = check_migrations.column_drop_errors(
            set(),
            {("events", "sequence")},
            {
                (table.name, column.name)
                for table in Base.metadata.tables.values()
                for column in table.columns
            },
            {},
        )
        assert len(errors) == 1
        assert "UNMAPPED_COLUMNS entry still exists in model metadata" in errors[0]
        assert "deferred=True is not sufficient" in errors[0]
