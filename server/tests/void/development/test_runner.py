import argparse
import os
import signal
from pathlib import Path
from unittest.mock import Mock

import pytest

from scripts import void_dev


@pytest.mark.parametrize("action", ["smoke", "down"])
def test_interrupted_command_fails(
    action: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("sys.argv", ["void_dev", action])
    monkeypatch.setattr(signal, "signal", Mock())
    monkeypatch.setattr(void_dev, "run", Mock(side_effect=KeyboardInterrupt))
    with pytest.raises(SystemExit) as error:
        void_dev.main()
    assert error.value.code == 130


def test_environment_excludes_existing_services(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    for key in (
        "POLAR_POSTGRES_URL_NON_POOLING",
        "POLAR_POSTGRES_READ_REPLICA_HOST",
        "POLAR_VOID_TINYBIRD_API_TOKEN",
        "AWS_PROFILE",
        "VOID_TOKEN",
        "LOGFIRE_TOKEN",
    ):
        monkeypatch.setenv(key, "existing-service")
    arguments = argparse.Namespace(
        email_renderer=tmp_path / "renderer",
        postgres_port=5544,
        redis_port=6384,
        minio_port=9180,
        tinybird_port=7281,
        temporal_port=7333,
        temporal_ui_port=8333,
        api_port=8010,
    )
    env = void_dev.environment(arguments, tmp_path)
    assert "existing-service" not in env.values()
    assert env["POLAR_POSTGRES_DATABASE"] == "polar_void_dev"
    assert env["POLAR_POSTGRES_PORT"] == "5544"
    assert env["POLAR_JWKS"] == str(tmp_path / ".jwks.json")


def test_rejects_unowned_state_before_mutation(tmp_path: Path) -> None:
    existing = tmp_path / "alembic.ini"
    existing.write_text("existing configuration")
    with pytest.raises(RuntimeError, match="empty state directory"):
        void_dev.run(argparse.Namespace(state_dir=tmp_path))
    assert existing.read_text() == "existing configuration"
    assert list(tmp_path.iterdir()) == [existing]


def test_shutdown_tolerates_process_exit(monkeypatch: pytest.MonkeyPatch) -> None:
    process = Mock()
    process.poll.return_value = None
    monkeypatch.setattr(os, "killpg", Mock(side_effect=ProcessLookupError))
    void_dev.stop([process])
    process.wait.assert_called_once_with(timeout=15)
