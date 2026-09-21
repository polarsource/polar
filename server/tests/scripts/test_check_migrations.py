from collections.abc import Sequence

import pytest

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
