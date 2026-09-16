import os
import subprocess
import sys
from pathlib import Path

import pytest

from polar.invoice.renderer import build_renderer_env


class TestRendererEnvironment:
    def test_bootstrap_loads_server_configuration_from_another_directory(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        server_directory = Path(__file__).resolve().parents[2]
        monkeypatch.setenv("POLAR_ENV", "testing")
        monkeypatch.setenv("POLAR_LOCAL_JWKS", str(server_directory / ".jwks.json"))
        monkeypatch.setenv("POLAR_EMAIL_RENDERER_BINARY_PATH", sys.executable)
        monkeypatch.delenv("POLAR_S3_CUSTOMER_INVOICES_BUCKET_NAME", raising=False)
        monkeypatch.setenv("PYTHONPATH", str(server_directory))
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import polar.invoice._renderer_bootstrap; "
                    "from polar.config import settings; "
                    "assert settings.S3_CUSTOMER_INVOICES_BUCKET_NAME "
                    "== 'testing-polar-s3', settings.S3_CUSTOMER_INVOICES_BUCKET_NAME"
                ),
            ],
            cwd=tmp_path,
            capture_output=True,
            check=False,
        )

        assert result.returncode == 0, result.stderr.decode()

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
