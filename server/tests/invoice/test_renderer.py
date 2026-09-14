import os
import subprocess
import sys
from pathlib import Path

import pytest

from polar.invoice.renderer import build_renderer_env


class TestRendererEnvironment:
    def test_preserves_configuration(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("POLAR_ENV", "testing")
        monkeypatch.setenv("POLAR_CUSTOM_OVERRIDE", "1")
        monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", "/tmp/should-not-leak")
        monkeypatch.setenv("UNRELATED_RUNTIME_VAR", "ignore-me")

        env = build_renderer_env()

        assert env["POLAR_ENV"] == "testing"
        assert env["POLAR_CUSTOM_OVERRIDE"] == "1"
        assert env["PATH"] == os.environ["PATH"]
        assert "PROMETHEUS_MULTIPROC_DIR" not in env
        assert "UNRELATED_RUNTIME_VAR" not in env

    def test_bootstrap_filters_environment_before_importing_renderers(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        prometheus_dir = str(tmp_path / "worker-only")
        monkeypatch.setenv("POLAR_CUSTOM_OVERRIDE", "1")
        monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", prometheus_dir)
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import polar.invoice._renderer_bootstrap; import os; "
                    "assert os.environ.get('PROMETHEUS_MULTIPROC_DIR') "
                    f"!= {prometheus_dir!r}; "
                    "assert os.environ['POLAR_CUSTOM_OVERRIDE'] == '1'"
                ),
            ],
            capture_output=True,
            check=False,
        )

        assert result.returncode == 0, result.stderr.decode()
        assert os.environ["PROMETHEUS_MULTIPROC_DIR"] == prometheus_dir
